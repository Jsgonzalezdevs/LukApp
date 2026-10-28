import { describe, expect, it } from 'vitest';
import { esDominioAppPrincipal, HOST_APP_PRINCIPAL, urlAppPrincipal } from './dominios';

describe('dominio de acceso principal', () => {
  it('reconoce solo el subdominio de la aplicación', () => {
    expect(HOST_APP_PRINCIPAL).toBe('mi.lukapp.app');
    expect(esDominioAppPrincipal('mi.lukapp.app')).toBe(true);
    expect(esDominioAppPrincipal('lukapp.app')).toBe(false);
    expect(esDominioAppPrincipal('www.lukapp.app')).toBe(false);
  });

  it('construye enlaces de acceso con o sin barra inicial', () => {
    expect(urlAppPrincipal('/entrar')).toBe('https://mi.lukapp.app/entrar');
    expect(urlAppPrincipal('registro')).toBe('https://mi.lukapp.app/registro');
  });
});
