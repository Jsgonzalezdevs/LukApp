import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

type Respuesta = { id: string; estado?: string; nivel?: number; base64?: string; error?: string };
export function useGrabacionNativa(enviar: (respuesta: Respuesta) => void) {
  const grabadora = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const estado = useAudioRecorderState(grabadora, 100);
  const activa = useRef<string | null>(null);
  const cola = useRef(Promise.resolve());
  const respuesta = useRef(enviar);
  respuesta.current = enviar;
  useEffect(() => {
    if (activa.current && estado.isRecording) respuesta.current({ id: activa.current, estado: 'escuchando', nivel: Math.max(0, Math.min(1, ((estado.metering ?? -60) + 60) / 60)) });
  }, [estado.isRecording, estado.metering]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (valor) => {
      if (valor === 'active' || !activa.current) return;
      const id = activa.current;
      activa.current = null;
      void grabadora.stop().catch(() => {});
      respuesta.current({ id, error: 'La grabación se interrumpió al salir de LukApp. Intenta otra vez.' });
    });
    return () => sub.remove();
  }, [grabadora]);
  return (id: string, accion: string) => {
    cola.current = cola.current.then(async () => {
      try {
        if (accion === 'inicio') {
          if (activa.current) throw new Error('Ya hay una grabación en curso.');
          const permiso = await AudioModule.requestRecordingPermissionsAsync();
          if (!permiso.granted) throw new Error('Permite el micrófono en Ajustes de Android → LukApp → Permisos.');
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
          activa.current = id;
          await grabadora.prepareToRecordAsync();
          grabadora.record();
          respuesta.current({ id, estado: 'escuchando', nivel: 0 });
        } else if (activa.current === id) {
          await grabadora.stop();
          const uri = grabadora.uri;
          activa.current = null;
          if (accion === 'cancelar') {
            if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
            return;
          }
          if (!uri) throw new Error('Android no generó el archivo de audio.');
          const info = await FileSystem.getInfoAsync(uri);
          if (!info.exists || info.size < 512) throw new Error('La grabación quedó vacía. Comprueba que el micrófono no esté bloqueado.');
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          await FileSystem.deleteAsync(uri, { idempotent: true });
          respuesta.current({ id, estado: 'audio', base64 });
        }
      } catch (error) {
        activa.current = null;
        await grabadora.stop().catch(() => {});
        respuesta.current({ id, error: error instanceof Error ? error.message : 'No se pudo grabar el audio en Android.' });
      }
    });
  };
}
