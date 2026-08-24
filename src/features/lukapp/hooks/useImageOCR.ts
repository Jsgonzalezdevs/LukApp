import { useState } from 'react';

const prepararImagen = async (file: File): Promise<Blob | File> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_DIM = 1200;
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
      const result = await Tesseract.recognize(optimizado, 'spa', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(m.progress);
          }
        },
      });

      const text = result.data.text;
      const cleanText = text.replace(/\n+/g, ' ').trim();

      onSuccess(`[OCR] ${cleanText}`);
    } catch (err) {
      console.error('Error procesando imagen con OCR:', err);
      setError('No se pudo analizar la imagen. Intenta con otra foto más nítida.');
    } finally {
      setIsScanning(false);
      setProgress(0);
    }
  };

  return { scanImage, isScanning, progress, error };
};

