import * as React from "react"
import { Dialog } from "radix-ui"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const DialogRoot = Dialog.Root
const DialogTrigger = Dialog.Trigger
const DialogClose = Dialog.Close
const DialogTitle = Dialog.Title
const DialogDescription = Dialog.Description

function DialogOverlay({ className, ...props }) {
  return (
    <Dialog.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({ className, children, ...props }) {
  return (
    <Dialog.Portal>
      <DialogOverlay />
      <Dialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        <Dialog.Close className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <X className="size-4" />
          <span className="sr-only">Cerrar</span>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  )
}

function DialogHeader({ className, ...props }) {
  return <div className={cn("mb-5 space-y-1", className)} {...props} />
}

function DialogFooter({ className, ...props }) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />
}

export {
  DialogRoot,
  DialogTrigger,
  DialogClose,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogHeader,
  DialogFooter,
}
