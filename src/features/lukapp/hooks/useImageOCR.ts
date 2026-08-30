import { useState } from 'react';

class SinTextoEnImagenError extends Error {
  constructor() {
    super('La imagen no contenía texto legible');
    this.name = 'SinTextoEnImagenError';
  }
}

const limpiarTextoOCR = (text: string): string =>
  text
    .replace(/[|]/g, 'I')
    .replace(/[“”]/g, '"')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

const prepararImagen = async (file: File): Promise<Blob | File> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Una factura suele traer letra bastante más pequeña que un recibo de
      // transferencia. 2.000 px mantiene legible ese detalle sin mandar una
      // foto original enorme al worker de OCR.
      const MAX_DIM = 2000;
      let width = img.width;
      let height = img.height;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      // Los comprobantes suelen tener letra pequeña sobre fondos con degradado.
      // Este contraste moderado ayuda al OCR sin convertir una foto normal en
      // una imagen ilegible ni depender de servicios externos.
      ctx.filter = 'grayscale(1) contrast(1.55) brightness(1.1)';
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          resolve(blob ?? file);
        },
        'image/jpeg',
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
};

export const useImageOCR = (onSuccess: (text: string) => void) => {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const scanImage = async (file: File) => {
    setIsScanning(true);
    setProgress(0.05);
    setError(null);

    try {
      const optimizado = await prepararImagen(file);

      // Import dinámico a propósito: Tesseract solo se descarga cuando se usa
      const { default: Tesseract } = await import('tesseract.js');
      const reconocer = async (imagen: Blob | File) => {
        const result = await Tesseract.recognize(imagen, 'spa', {
          logger: (m) => {
            if (m.status === 'recognizing text') setProgress(m.progress);
          },
        });
        return limpiarTextoOCR(result.data.text);
      };

      let cleanText = '';
      try {
        cleanText = await reconocer(optimizado);
      } catch (errorOptimizado) {
        if (optimizado === file) throw errorOptimizado;
        // El JPEG derivado puede fallar en Safari aunque el archivo original
        // sea perfectamente válido para el worker de OCR.
        cleanText = await reconocer(file);
      }

      // Algunos comprobantes ya nítidos (sobre todo capturas de apps bancarias)
      // pierden trazos finos al pasar por el canvas de iOS. Si no se obtuvo
      // texto útil, el archivo original tiene una segunda oportunidad antes de
      // decirle a la persona que su foto tiene un problema.
      if (cleanText.length < 3 && optimizado !== file) {
        cleanText = await reconocer(file);
      }

      if (cleanText.length < 3) throw new SinTextoEnImagenError();

      // El prefijo permite al parser aplicar reglas propias de facturas y
      // comprobantes, sin confundirlas con un dictado normal.
      onSuccess(`[OCR] ${cleanText}`);
    } catch (err) {
      console.error('Error procesando imagen con OCR:', err);
      if (err instanceof SinTextoEnImagenError) {
        setError('No encontramos texto en la imagen. Sube el comprobante completo o inténtalo de nuevo.');
      } else {
        // Una caída del worker, falta de memoria o un formato que el navegador
        // no abre no dicen nada sobre la nitidez. El mensaje anterior culpaba
        // erróneamente a la foto y escondía la posibilidad de reintentar.
        setError('No pudimos leer el archivo en este momento. Tu foto puede estar bien; inténtalo otra vez.');
      }
    } finally {
      setIsScanning(false);
      setProgress(0);
    }
  };

  return { scanImage, isScanning, progress, error };
};
