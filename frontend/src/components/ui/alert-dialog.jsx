import * as React from "react"
import { AlertDialog } from "radix-ui"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const AlertDialogRoot = AlertDialog.Root
const AlertDialogTrigger = AlertDialog.Trigger
const AlertDialogTitle = AlertDialog.Title
const AlertDialogDescription = AlertDialog.Description

function AlertDialogOverlay({ className, ...props }) {
  return (
    <AlertDialog.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({ className, ...props }) {
  return (
    <AlertDialog.Portal>
      <AlertDialogOverlay />
      <AlertDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </AlertDialog.Portal>
  )
}

function AlertDialogHeader({ className, ...props }) {
  return <div className={cn("mb-5 space-y-2", className)} {...props} />
}

function AlertDialogFooter({ className, ...props }) {
  return <div className={cn("flex justify-end gap-2", className)} {...props} />
}

function AlertDialogAction({ className, ...props }) {
  return (
    <AlertDialog.Action
      className={cn(buttonVariants({ variant: "destructive" }), className)}
      {...props}
    />
  )
}

function AlertDialogCancel({ className, ...props }) {
  return (
    <AlertDialog.Cancel
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  )
}

export {
  AlertDialogRoot,
  AlertDialogTrigger,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
}
