"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="text-8xl flex flex-col justify-center items-center gap-4">
      <Link href="/sender">Sender</Link>
      <Link href="/receiver">Receiver</Link>
    </div>
  );
}
