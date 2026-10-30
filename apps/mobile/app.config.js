/**
 * La compilación de prueba usa otro identificador para instalarse al lado de
 * la versión firmada por Play sin reemplazarla ni borrar sus datos locales.
 */
module.exports = ({ config }) => {
  const esPrueba = process.env.APP_VARIANT === 'preview';

  return {
    ...config,
    name: esPrueba ? 'LukApp Pruebas' : config.name,
    android: {
      ...config.android,
      package: esPrueba ? 'app.lukapp.android.preview' : config.android.package,
    },
  };
};
