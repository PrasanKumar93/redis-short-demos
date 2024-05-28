/*
  basic console logger
*/
class LoggerCls {
  static getPureError(err: unknown) {
    return JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err)));
  }

  static stringifyDetails(_details: unknown) {
    if (!_details) {
      _details = null;
    } else {
      _details = JSON.stringify(_details, null, 4);
    }
    return _details;
  }

  static debug(_message: string, _details?: unknown): void {
    if (_message) {
      _details = LoggerCls.stringifyDetails(_details);
      // console.debug(_message, { meta: _details });
    }
  }

  static info(_message: string, _details?: unknown): void {
    if (_message) {
      _details = LoggerCls.stringifyDetails(_details);
      console.info(_message, _details ?? { meta: _details });
    }
  }

  static error(_message: string, _details?: unknown): void {
    if (_message) {
      _details = LoggerCls.stringifyDetails(_details);
      console.error(_message, _details ?? { meta: _details });
    }
  }
}

export { LoggerCls };
