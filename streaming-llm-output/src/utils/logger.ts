/*
  basic console logger
*/
class LoggerCls {
  static getPureError(err: unknown) {
    return JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err)));
  }

  static logDetails(_details: unknown) {
    if (_details) {
      _details = JSON.stringify(_details, null, 4);
      console.log(_details);
    }
  }

  static debug(_message: string, _details?: unknown): void {
    if (_message) {
      // console.debug(_message);
      LoggerCls.logDetails(_details);
    }
  }

  static info(_message: string, _details?: unknown): void {
    if (_message) {
      console.info(_message);

      LoggerCls.logDetails(_details);
    }
  }

  static error(_message: string, _details?: unknown): void {
    if (_message) {
      console.error(_message);

      LoggerCls.logDetails(_details);
    }
  }
}

export { LoggerCls };
