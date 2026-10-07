"use client";

import { Suspense } from "react";
import { Register } from "@/components/register/register";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <Register />
    </Suspense>
  );
}
