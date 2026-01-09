import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  let attempt = 0;
  let lastError: Error | null = null;

  // Retry logic: try up to 2 times
  for (attempt = 1; attempt <= 2; attempt++) {
    try {
      // Execute a simple query to wake up the database
      await query('SELECT 1');

      const duration = Date.now() - startTime;

      return NextResponse.json({
        status: 'ok',
        time: new Date().toISOString(),
        message: 'Database connection successful',
        attempt,
        duration: `${duration}ms`
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Log the error with attempt number
      console.error(`Health check attempt ${attempt} failed:`, {
        error: lastError.message,
        code: (error as any)?.code,
        errno: (error as any)?.errno,
      });

      // If this was the first attempt and we got a connection error, wait and retry
      if (attempt === 1) {
        const isConnectionError =
          lastError.message.includes('ECONNRESET') ||
          lastError.message.includes('ETIMEDOUT') ||
          lastError.message.includes('ENOTFOUND') ||
          (error as any)?.code === 'ECONNRESET' ||
          (error as any)?.code === 'ETIMEDOUT';

        if (isConnectionError) {
          console.log('Connection error detected, waiting 2s before retry...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue; // Retry
        }
      }

      // For non-connection errors on first attempt, don't retry
      break;
    }
  }

  // All attempts failed
  const duration = Date.now() - startTime;

  return NextResponse.json(
    {
      status: 'error',
      time: new Date().toISOString(),
      message: lastError?.message || 'Database connection failed',
      attempts: attempt,
      duration: `${duration}ms`,
      code: (lastError as any)?.code,
    },
    { status: 503 } // Service Unavailable (temporary)
  );
}
