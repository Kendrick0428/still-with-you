"use client";
import { useEffect } from "react";

// Email links from Supabase can land on the home page; send them into the app, which knows what to do with them.
export default function AuthForward() {
  useEffect(() => {
    const h = location.hash;
    if (/[#&](access_token|error_code|type)=/.test(h)) location.replace("/app" + h);
  }, []);
  return null;
}
