import { describe, expect, it } from 'vitest';
import {
  CABECERAS_API_SEGURAS,
  esOrigenCorsPermitido,
  origenesCorsPermitidos,
} from './seguridadHttp';

describe('seguridad HTTP', () => {
  it('acepta solo los orígenes públicos de LukApp en producción por defecto', () => {
    const permitidos = origenesCorsPermitidos({ NODE_ENV: 'production' });

    expect(esOrigenCorsPermitido('https://lukapp.app', permitidos)).toBe(true);
    expect(esOrigenCorsPermitido('https://www.lukapp.app', permitidos)).toBe(true);
    expect(esOrigenCorsPermitido('https://sitio-malicioso.example', permitidos)).toBe(false);
    expect(esOrigenCorsPermitido('http://localhost:5173', permitidos)).toBe(false);
  });

  it('permite una lista explícita, normalizada y sin abrir http remoto', () => {
    const permitidos = origenesCorsPermitidos({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://preview.lukapp.app/, http://inseguro.example, https://lukapp.app',
    });

    expect([...permitidos]).toEqual(['https://preview.lukapp.app', 'https://lukapp.app']);
    expect(esOrigenCorsPermitido('https://preview.lukapp.app', permitidos)).toBe(true);
    expect(esOrigenCorsPermitido('http://inseguro.example', permitidos)).toBe(false);
  });

  it('mantiene localhost únicamente al desarrollar y no exige Origin a clientes no navegadores', () => {
    const permitidos = origenesCorsPermitidos({ NODE_ENV: 'development' });

    expect(esOrigenCorsPermitido('http://localhost:5173', permitidos)).toBe(true);
    expect(esOrigenCorsPermitido(undefined, permitidos)).toBe(true);
  });

  it('marca todas las respuestas privadas como no almacenables ni interpretables como HTML', () => {
    expect(CABECERAS_API_SEGURAS['Cache-Control']).toContain('no-store');
    expect(CABECERAS_API_SEGURAS['X-Content-Type-Options']).toBe('nosniff');
    expect(CABECERAS_API_SEGURAS['Content-Security-Policy']).toContain("default-src 'none'");
  });
});
