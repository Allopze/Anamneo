import { ForbiddenException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { csrfMiddleware } from './csrf.middleware';

function build(
  method: string,
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {},
  originalUrl = '/api/patients',
) {
  const res = {
    cookie: jest.fn(),
  } as unknown as Response;

  const req = {
    method,
    cookies,
    headers,
    originalUrl,
    path: originalUrl,
  } as unknown as Request;

  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe('csrfMiddleware', () => {
  it('sets a csrf cookie if missing on safe requests', () => {
    const { req, res, next } = build('GET', {});
    csrfMiddleware(req, res, next);
    expect(res.cookie).toHaveBeenCalledWith('csrf_token', expect.any(String), expect.objectContaining({
      httpOnly: false, sameSite: 'strict',
    }));
    expect(next).toHaveBeenCalledWith();
  });

  it('passes safe methods through without validation', () => {
    const { req, res, next } = build('GET', { csrf_token: 'abc' });
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects mutating method without matching header', () => {
    const { req, res, next } = build('POST', { csrf_token: 'abc' }, {});
    csrfMiddleware(req, res, next);
    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(ForbiddenException);
  });

  it('rejects mutating method with mismatched header', () => {
    const { req, res, next } = build('POST', { csrf_token: 'abc' }, { 'x-csrf-token': 'xyz' });
    csrfMiddleware(req, res, next);
    expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(ForbiddenException);
  });

  it('accepts mutating method when header matches cookie', () => {
    const token = 'a'.repeat(32);
    const { req, res, next } = build('POST', { csrf_token: token }, { 'x-csrf-token': token });
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('exempts /api/auth/login', () => {
    const { req, res, next } = build('POST', {}, {}, '/api/auth/login');
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('exempts /api/auth/forgot-password', () => {
    const { req, res, next } = build('POST', {}, {}, '/api/auth/forgot-password');
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('exempts /api/auth/refresh', () => {
    const { req, res, next } = build('POST', {}, {}, '/api/auth/refresh');
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});
