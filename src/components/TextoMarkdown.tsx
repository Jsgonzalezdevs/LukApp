import React from 'react';

/** Renderiza el Markdown breve que usa el Asesor sin interpretar HTML. */
export const TextoMarkdown: React.FC<{ texto: string }> = ({ texto }) => {
  const renderLinea = (linea: string, clave: string) => {
    const partes = linea.split(/(\*\*\s*.+?\s*\*\*|(?<!\*)\*[^*\n]+\*(?!\*)|`[^`\n]+`)/g);
    return partes.map((parte, indice) => {
      if (parte.startsWith('**') && parte.endsWith('**')) {
        return <strong key={`${clave}-${indice}`} className="font-semibold">{parte.slice(2, -2).trim()}</strong>;
      }
      if (parte.startsWith('`') && parte.endsWith('`')) {
        return <code key={`${clave}-${indice}`} className="rounded bg-black/5 px-1 py-0.5 text-[0.92em] dark:bg-white/10">{parte.slice(1, -1)}</code>;
      }
      if (parte.startsWith('*') && parte.endsWith('*')) {
        return <em key={`${clave}-${indice}`}>{parte.slice(1, -1)}</em>;
      }
      return parte;
    });
  };

  return (
    <div className="space-y-2">
      {texto.split(/\n\s*\n/).map((parrafo, indice) => {
        const lineas = parrafo.split('\n');
        const esLista = lineas.every((linea) => /^\s*[-*•]\s+/.test(linea));
        if (esLista) {
          return (
            <ul key={indice} className="list-disc space-y-1 pl-5">
              {lineas.map((linea, numero) => (
                <li key={numero}>{renderLinea(linea.replace(/^\s*[-*•]\s+/, ''), `${indice}-${numero}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={indice}>
            {lineas.map((linea, numero) => (
              <React.Fragment key={numero}>
                {renderLinea(linea, `${indice}-${numero}`)}
                {numero < lineas.length - 1 ? <br /> : null}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};
