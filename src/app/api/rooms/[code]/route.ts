import { NextRequest } from 'next/server';

interface RoomSnapshot {
  code: string;
  seq: number;
  updatedAt: number;
  payload: unknown;
}

const globalRooms = globalThis as unknown as {
  __uclRooms?: Map<string, RoomSnapshot>;
  __uclSubscribers?: Map<string, Set<(snap: RoomSnapshot) => void>>;
};

function getRooms() {
  if (!globalRooms.__uclRooms) {
    globalRooms.__uclRooms = new Map();
  }
  return globalRooms.__uclRooms;
}

function getSubscribers() {
  if (!globalRooms.__uclSubscribers) {
    globalRooms.__uclSubscribers = new Map();
  }
  return globalRooms.__uclSubscribers;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const roomKey = code.toUpperCase();
  const stream = request.nextUrl.searchParams.get('stream') === '1';

  if (!stream) {
    const snap = getRooms().get(roomKey) ?? null;
    return Response.json({ room: snap });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;

  const body = new ReadableStream({
    start(controller) {
      const send = (snap: RoomSnapshot) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(snap)}\n\n`)
          );
        } catch {
          // stream closed
        }
      };

      const existing = getRooms().get(roomKey);
      if (existing) send(existing);

      const subs = getSubscribers();
      if (!subs.has(roomKey)) subs.set(roomKey, new Set());
      const set = subs.get(roomKey)!;
      set.add(send);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      cleanup = () => {
        clearInterval(heartbeat);
        set.delete(send);
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const roomKey = code.toUpperCase();
  const data = (await request.json()) as { seq?: number; payload: unknown };
  const prev = getRooms().get(roomKey);
  const seq = typeof data.seq === 'number' ? data.seq : (prev?.seq ?? 0) + 1;

  const snap: RoomSnapshot = {
    code: roomKey,
    seq,
    updatedAt: Date.now(),
    payload: data.payload,
  };
  getRooms().set(roomKey, snap);

  const subs = getSubscribers().get(roomKey);
  if (subs) {
    for (const cb of subs) {
      cb(snap);
    }
  }

  return Response.json({ ok: true, seq });
}
