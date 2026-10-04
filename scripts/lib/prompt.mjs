// Prompt de contraseña compartido por los scripts de scripts/.
// Lee la contraseña tecla a tecla en modo raw: no la muestra, admite pegar y borrar, y al terminar solo
// informa de CUANTOS caracteres recibio (nunca cuales), para detectar al instante un pegado vacio o de mas.
export function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let buf = "";
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const finish = (value, err) => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write(`\n(recibidos ${value?.length ?? 0} caracteres)\n`);
      err ? reject(err) : resolve(value);
    };
    const onData = (chunk) => {
      const text = chunk.replace(/\x1b\[20[01]~/g, "");
      for (const ch of text) {
        if (ch === "\r" || ch === "\n") return finish(buf);
        if (ch === "\u0003") return finish(buf, new Error("Cancelado"));
        if (ch === "\u007f" || ch === "\b") buf = buf.slice(0, -1);
        else if (ch >= " ") buf += ch;
      }
    };
    stdin.on("data", onData);
  });
}
