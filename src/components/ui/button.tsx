import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent-500 text-ink-950 hover:bg-accent-400",
        confirm: "bg-signal-400 text-ink-950 hover:bg-signal-400/85",
        danger: "bg-ink-800 text-danger-400 ring-2 ring-danger-400/60 hover:bg-ink-700",
        ghost: "bg-ink-850 text-mist-50 ring-1 ring-ink-700 hover:bg-ink-800",
        link: "text-accent-400 underline underline-offset-4 hover:text-accent-400/80",
      },
      size: {
        // 56px+ everywhere: comfortably above the 44px minimum touch target,
        // which matters when the user is tapping without looking.
        md: "min-h-14 px-6 text-base",
        lg: "min-h-16 px-8 text-lg",
        xl: "min-h-20 w-full px-8 text-xl",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

export { buttonVariants };
