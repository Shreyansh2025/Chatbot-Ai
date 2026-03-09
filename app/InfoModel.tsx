import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface InfoModalProps {
  title: string;
  triggerText: string;
  children: React.ReactNode;
}

export function InfoModal({ title, triggerText, children }: InfoModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <a className="relative group cursor-pointer">
          {triggerText}
          <span className="absolute left-0 -bottom-1 w-0 h-[2px] bg-blue-500 transition-all duration-300 group-hover:w-full"></span>
        </a>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-500">{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 text-zinc-300 space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}