'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import {ArrowLeft, Home, LogIn, Plus} from 'lucide-react';
import {useRouter} from "next/navigation";

export default function NotFound(
  {
    tag = "Page",
    description = "The page you're looking for doesn't exist or has been moved.",
  }: any
) {
  const router = useRouter();

  return (
    <div className="min-h-[70svh] flex items-center justify-center p-4">
      <div className=" mx-auto text-center relative">
        {/* Animated glitch effect background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 animate-pulse rounded-lg blur-2xl" />

        {/* Main content container */}
        <div className="relative ">
          {/* Animated 404 text */}
          <h1 className="text-8xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary animate-gradient mb-4">
            404
          </h1>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            {tag} Not Found
          </h2>
          <p className="text-muted-foreground mb-8">
            {description}
          </p>
          {/* Navigation buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => router.back()}
              variant="outline"
              size="sm"
              className="group flex items-center gap-2 justify-center hover:border-primary transition-all"
            >
              <ArrowLeft className="h-4 w-4 group-hover:text-primary" />
              Go Back
            </Button>
            <Button
              onClick={() => router.push('/')}
              size="sm"
              className="bg-gradient-to-r flex gap-2 items-center justify-center text-white from-primary to-secondary hover:from-primary hover:to-secondary/50"
            >
              <Home className=" h-4 w-4" />
              Return Home
            </Button>
          </div>
          {/* Decorative elements */}
          <div className="absolute -top-20 sm:-left-20 left-0 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 sm:-right-20 right-0 w-40 h-40 bg-secondary/20 rounded-full blur-3xl" />
        </div>
      </div>
    </div>
  );
}
