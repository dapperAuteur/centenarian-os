import { Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function QuickCapture() {
  return (
    <div className="relative w-full">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Quick Capture: Log workout, add task, ask question..."
        className="w-full appearance-none bg-background pl-8 shadow-none"
      />
      <Button variant="outline" size="sm" className="absolute right-1.5 top-1.5 h-7">
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
