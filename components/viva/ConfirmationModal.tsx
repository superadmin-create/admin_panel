"use client";

import { Button } from "@/components/ui/button";

interface ConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
}

export function ConfirmationModal({
  isOpen,
  onConfirm,
  onCancel,
  title = "End Viva Session?",
  message = "Are you sure you want to end the viva session early? This action cannot be undone.",
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-xl font-semibold mb-3 text-white">{title}</h3>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
            className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            End Session
          </Button>
        </div>
      </div>
    </div>
  );
}
