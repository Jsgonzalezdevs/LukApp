import { describe, expect, it, vi } from 'vitest';
import { leerVocabularioPersonal, transcribirAudio } from './transcripcion';

const audio = new Blob(['voz'], { type: 'audio/webm' });

const respuesta = (cuerpo: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

describe('transcripción de voz', () => {
  it('usa el modelo de máxima precisión para la transcripción definitiva', async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockImplementation(() => respuesta({ text: 'Pagué veinte mil en Mi Bolsillo' }));

    const resultado = await transcribirAudio(audio, 'audio/webm', {
      entorno: { OPENAI_API_KEY: 'openai', GROQ_API_KEY: 'groq' },
      modo: 'final',
      vocabulario: ['Mi Bolsillo'],
      fetcher,
    });

    expect(resultado).toMatchObject({ success: true, text: 'Pagué veinte mil en Mi Bolsillo' });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, opciones] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    const formulario = opciones?.body as FormData;
    expect(formulario.get('model')).toBe('gpt-transcribe');
    expect(formulario.getAll('keywords[]')).toContain('Mi Bolsillo');
    expect(formulario.getAll('languages[]')).toEqual(['es']);
  });

  it('prioriza respuesta rápida en parciales y conserva Whisper grande', async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockImplementation(() => respuesta({ text: 'pagué veinte mil' }));

    await transcribirAudio(audio, 'audio/webm', {
      entorno: { OPENAI_API_KEY: 'openai', GROQ_API_KEY: 'groq' },
      modo: 'parcial',
      fetcher,
    });

    const [url, opciones] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    const formulario = opciones?.body as FormData;
    expect(formulario.get('model')).toBe('whisper-large-v3');
    expect(formulario.get('language')).toBe('es');
    expect(formulario.get('response_format')).toBe('verbose_json');
  });

  it('cae al segundo proveedor si el primero falla', async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher
      .mockImplementationOnce(() => respuesta({ error: 'sin cupo' }, 429))
      .mockImplementationOnce(() => respuesta({ text: 'recibí cien mil' }));

    const resultado = await transcribirAudio(audio, 'audio/webm', {
      entorno: { OPENAI_API_KEY: 'openai', GROQ_API_KEY: 'groq' },
      modo: 'final',
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect(resultado).toMatchObject({ success: true, text: 'recibí cien mil' });
  });

  it('calcula una señal baja cuando Whisper oyó principalmente silencio', async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockImplementation(() =>
      respuesta({
        text: 'pagué cincuenta mil',
        segments: [{ avg_logprob: -1.3, no_speech_prob: 0.7 }],
      }),
    );

    const resultado = await transcribirAudio(audio, 'audio/webm', {
      entorno: { GROQ_API_KEY: 'groq' },
      modo: 'final',
      fetcher,
    });

    expect(resultado).toMatchObject({ success: true, calidad: 'baja' });
  });
});

describe('vocabulario personalizado', () => {
  it('decodifica, limpia, deduplica y limita las pistas del cliente', () => {
    const cabecera = encodeURIComponent(
      JSON.stringify([' Mi Bolsillo ', 'mi bolsillo', 'Ana\nMaría', '', 42]),
    );
    expect(leerVocabularioPersonal(cabecera)).toEqual(['Mi Bolsillo', 'Ana María']);
  });

  it('ignora una cabecera inválida', () => {
    expect(leerVocabularioPersonal('%E0%A4%A')).toEqual([]);
  });
});
