import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MockStripeFormProps {
  onSuccess: () => void;
  amount: number;
}

export function MockStripeForm({ onSuccess, amount }: MockStripeFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [zip, setZip] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMessage(null);

    // Validate all fields
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    const cleanExpiry = expiry.replace(/\//g, '');
    const cleanCvc = cvc.replace(/\s/g, '');
    const cleanZip = zip.replace(/\s/g, '');

    // Validate card number (must be test card)
    if (cleanCardNumber !== "4242424242424242") {
      const error = "Invalid card number. Use test card: 4242 4242 4242 4242";
      setErrorMessage(error);
      toast({
        title: "Payment Failed",
        description: error,
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    // Validate expiry (must be MM/YY format and future date)
    if (!/^\d{2}\/?\d{2}$/.test(expiry)) {
      const error = "Invalid expiry date. Use format MM/YY (e.g., 12/34)";
      setErrorMessage(error);
      toast({
        title: "Payment Failed",
        description: error,
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    // Validate CVC (must be 3 digits)
    if (!/^\d{3}$/.test(cleanCvc)) {
      const error = "Invalid CVC. Must be 3 digits (e.g., 123)";
      setErrorMessage(error);
      toast({
        title: "Payment Failed",
        description: error,
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    // Validate ZIP (must be 5 digits)
    if (!/^\d{5}$/.test(cleanZip)) {
      const error = "Invalid ZIP code. Must be 5 digits (e.g., 12345)";
      setErrorMessage(error);
      toast({
        title: "Payment Failed",
        description: error,
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    // Simulate Stripe payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // All validations passed
    onSuccess();
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Test Mode Instructions */}
      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">
          Test Mode - Mock Payment Form
        </AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200 space-y-1">
          <p className="text-sm">Use these test card details for payment:</p>
          <div className="text-sm font-mono bg-blue-100 dark:bg-blue-900 p-2 rounded mt-1">
            <div>Card: 4242 4242 4242 4242</div>
            <div>Expiry: Any future date (e.g., 12/34)</div>
            <div>CVC: Any 3 digits (e.g., 123)</div>
            <div>ZIP: Any 5 digits (e.g., 12345)</div>
          </div>
        </AlertDescription>
      </Alert>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="border rounded-lg p-4 bg-card space-y-4">
        <div className="space-y-2">
          <Label htmlFor="card-number">Card Number</Label>
          <Input
            id="card-number"
            type="text"
            placeholder="4242 4242 4242 4242"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            maxLength={19}
            required
            data-testid="input-mock-card-number"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="expiry">Expiry</Label>
            <Input
              id="expiry"
              type="text"
              placeholder="12/34"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              maxLength={5}
              required
              data-testid="input-mock-expiry"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cvc">CVC</Label>
            <Input
              id="cvc"
              type="text"
              placeholder="123"
              value={cvc}
              onChange={(e) => setCvc(e.target.value)}
              maxLength={3}
              required
              data-testid="input-mock-cvc"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zip">ZIP</Label>
            <Input
              id="zip"
              type="text"
              placeholder="12345"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              maxLength={5}
              required
              data-testid="input-mock-zip"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <div>
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-bold">${(amount / 100).toFixed(2)}</p>
        </div>
        <Button
          type="submit"
          disabled={isProcessing}
          size="lg"
          data-testid="button-complete-payment"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Complete Payment
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Mock payment form for testing. No real charges will be made.
      </p>
    </form>
  );
}
