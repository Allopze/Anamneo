import { ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('scrubs non-HTTP exception logs and response metadata', () => {
    process.env.NODE_ENV = 'development';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const response = { status, json } as unknown as Response;
    const request = {
      method: 'GET',
      originalUrl: '/api/patients/123e4567-e89b-12d3-a456-426614174000?token=secret-token',
    } as Request;
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch(
      new Error('SMTP failed for paciente@example.test with {"smtpPassword":"super-secret"}'),
      host,
    );

    const logged = errorSpy.mock.calls[0]?.[0] as string;
    const parsedLog = JSON.parse(logged) as { path: string; message: string; stack?: string };
    expect(parsedLog.path).toBe('/api/patients/:id');
    expect(parsedLog.message).toBe('SMTP failed for [EMAIL] with {"smtpPassword":"[REDACTED]"}');
    expect(logged).not.toContain('paciente@example.test');
    expect(logged).not.toContain('super-secret');
    expect(logged).not.toContain('secret-token');

    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'SMTP failed for [EMAIL] with {"smtpPassword":"[REDACTED]"}',
      path: '/api/patients/:id',
    }));
  });
});
