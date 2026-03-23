import { Menu, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AppSidebar } from "./AppSidebar";
import logoImage from "@assets/image_1761361808622.png";

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 bg-background border-b md:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-mobile-menu" aria-label="Open navigation menu">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle className="flex items-center gap-2">
                <img 
                  src={logoImage} 
                  alt="Aithon Shield Logo" 
                  className="h-6 w-6 object-contain"
                />
                <span>Aithon Shield</span>
              </SheetTitle>
            </SheetHeader>
            <div className="h-[calc(100vh-65px)] overflow-y-auto">
              <AppSidebar />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 text-sm font-semibold">
          <img 
            src={logoImage} 
            alt="Aithon Shield Logo" 
            className="h-6 w-6 object-contain"
          />
          <span>Aithon Shield</span>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
