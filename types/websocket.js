interface WebSocketInterface {
  close(code?: string, reason?: string);
  sendText(data: string);
  sendBinary(data: Blob);
}