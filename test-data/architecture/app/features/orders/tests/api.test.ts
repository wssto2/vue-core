// A test may call fetch itself.
export const ping = () => fetch("/api/ping");
