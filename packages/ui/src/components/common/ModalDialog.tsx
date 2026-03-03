"use client";

/**
 * ModalDialog
 *
 * Base centered modal dialog component.
 * Uses Radix Dialog for accessibility.
 */

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { clsx } from "clsx";

interface ModalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Prevent closing on overlay click */
  preventClose?: boolean;
}

export function ModalDialog({
  open,
  onOpenChange,
  children,
  preventClose = false,
}: ModalDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={clsx(
            "fixed inset-0 z-50",
            "bg-black/80 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          onPointerDownOutside={(e) => {
            if (preventClose) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (preventClose) {
              e.preventDefault();
            }
          }}
          className={clsx(
            "fixed left-[50%] top-[50%] z-50",
            "translate-x-[-50%] translate-y-[-50%]",
            "bg-pixel-bg-dark",
            "border-4 border-pixel-primary",
            "shadow-[8px_8px_0_0_#000,inset_-4px_-4px_0_0_rgba(0,0,0,0.3),inset_4px_4px_0_0_rgba(255,255,255,0.05)]",
            "rounded-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "duration-200",
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default ModalDialog;
