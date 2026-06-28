/**
 * Logger Utility - Production logging with levels
 *
 * @module Logger
 */

import AdsConfig from '../config/AdsConfig';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class LoggerClass {
  private _enabled: boolean = true;

  constructor() {
    this._enabled = AdsConfig.debug;
  }

  private _log(
    level: LogLevel,
    tag: string,
    message: string,
    ...args: any[]
  ): void {
    if (!this._enabled && level !== 'error') {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[AdsSDK][${timestamp}][${level.toUpperCase()}][${tag}]`;

    if (args.length > 0) {
      console.log(prefix, message, ...args);
    } else {
      console.log(prefix, message);
    }
  }

  public debug(tag: string, message: string, ...args: any[]): void {
    this._log('debug', tag, message, ...args);
  }

  public info(tag: string, message: string, ...args: any[]): void {
    this._log('info', tag, message, ...args);
  }

  public warn(tag: string, message: string, ...args: any[]): void {
    this._log('warn', tag, message, ...args);
  }

  public error(tag: string, message: string, ...args: any[]): void {
    this._log('error', tag, message, ...args);
  }

  public enable(): void {
    this._enabled = true;
  }

  public disable(): void {
    this._enabled = false;
  }
}

export const Logger = new LoggerClass();
export default Logger;
