import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function Home() {
  const tripCode = (await cookies()).get('last_trip_code')?.value;
  redirect(tripCode ? `/expenses?code=${tripCode}` : '/expenses');
}
