import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Execute a simple query to wake up the database
    await query('SELECT 1');

    return NextResponse.json({
      status: 'ok',
      time: new Date().toISOString(),
      message: 'Database connection successful'
    });
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'error',
        time: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
