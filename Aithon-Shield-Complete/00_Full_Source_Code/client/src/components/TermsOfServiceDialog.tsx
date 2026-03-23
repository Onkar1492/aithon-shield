import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function TermsOfServiceDialog() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [hasRead, setHasRead] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  
  const userId = user?.id;

  // Check if user has already accepted ToS
  const { data: tosStatus, isLoading } = useQuery<{ accepted: boolean; version: string | null; acceptedAt?: Date }>({
    queryKey: ["/api/terms-of-service/status"],
    enabled: !!userId,
    retry: false,
  });

  const acceptToSMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/terms-of-service/accept", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terms-of-service/status"] });
      toast({
        title: "Terms Accepted",
        description: "Thank you for accepting our Terms of Service",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record acceptance. Please try again.",
        variant: "destructive",
      });
      setIsAccepting(false);
    },
  });

  const handleAccept = async () => {
    if (!hasRead) {
      toast({
        title: "Please Confirm",
        description: "You must confirm that you have read and understood the terms",
        variant: "destructive",
      });
      return;
    }

    setIsAccepting(true);
    acceptToSMutation.mutate();
  };

  // Don't show dialog if already accepted or still loading
  if (isLoading || tosStatus?.accepted) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <DialogTitle className="text-2xl">Terms of Service & Legal Disclaimer</DialogTitle>
          </div>
          <DialogDescription>
            Please read and accept our Terms of Service before using Aithon Shield
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 text-sm">
            {/* Last Updated */}
            <div>
              <p className="text-xs text-muted-foreground">Last Updated: {new Date().toLocaleDateString()}</p>
              <p className="text-xs text-muted-foreground">Version: 1.0</p>
            </div>

            <Separator />

            {/* 1. Acceptance of Terms */}
            <section>
              <h3 className="font-bold text-base mb-2">1. ACCEPTANCE OF TERMS</h3>
              <p className="mb-2">
                By accessing or using Aithon Shield (the "Service"), whether through our web application or mobile application, 
                you ("User", "you", or "your") agree to be bound by these Terms of Service ("Terms"). If you do not agree to all 
                of these Terms, do not access or use the Service.
              </p>
              <p>
                These Terms constitute a legally binding agreement between you and the operators of Aithon Shield ("we", "us", or "our"). 
                Your use of the Service is also governed by our Privacy Policy.
              </p>
            </section>

            {/* 2. AI-Generated Content & No Warranty */}
            <section>
              <h3 className="font-bold text-base mb-2">2. AI-GENERATED CONTENT & NO WARRANTY</h3>
              <p className="mb-2 font-semibold">
                THE SERVICE USES ARTIFICIAL INTELLIGENCE TO GENERATE SECURITY ASSESSMENTS, VULNERABILITY REPORTS, AND CODE FIXES. 
                ALL OUTPUTS ARE PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND.
              </p>
              <div className="space-y-2">
                <p><strong>2.1 Nature of AI Analysis:</strong> The Service employs machine learning models, large language models (LLMs), 
                and other AI technologies to analyze code, applications, and systems. These AI models may:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Produce false positives (flagging issues that don't exist)</li>
                  <li>Produce false negatives (missing actual security vulnerabilities)</li>
                  <li>Generate incorrect or suboptimal remediation suggestions</li>
                  <li>Misinterpret code context or business logic</li>
                  <li>Provide outdated security recommendations</li>
                </ul>

                <p><strong>2.2 No Guarantee of Accuracy:</strong> We make no representations or warranties regarding the accuracy, completeness, 
                reliability, or suitability of any AI-generated content. Security findings and recommendations may not reflect the latest threats, 
                vulnerabilities, or industry best practices.</p>

                <p><strong>2.3 Professional Review Required:</strong> All AI-generated security assessments, vulnerability reports, and code fixes 
                MUST be independently reviewed and validated by qualified cybersecurity professionals before implementation in any production environment.</p>

                <p><strong>2.4 Not a Substitute for Professional Services:</strong> The Service is not a substitute for professional cybersecurity 
                consulting, penetration testing, or security auditing by qualified human experts.</p>
              </div>
            </section>

            {/* 3. Limitation of Liability */}
            <section>
              <h3 className="font-bold text-base mb-2">3. LIMITATION OF LIABILITY</h3>
              <div className="space-y-2">
                <p className="font-semibold uppercase">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY DAMAGES ARISING FROM YOUR USE OF THE SERVICE.
                </p>

                <p><strong>3.1 No Liability for AI Errors:</strong> We are not liable for any damages, losses, security breaches, data loss, 
                financial loss, reputational harm, or any other consequences resulting from:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Reliance on AI-generated security assessments or recommendations</li>
                  <li>Implementation of AI-generated code fixes or patches</li>
                  <li>False negatives (undetected vulnerabilities)</li>
                  <li>False positives (incorrectly flagged issues)</li>
                  <li>Any inaccuracies, errors, or omissions in AI-generated content</li>
                </ul>

                <p><strong>3.2 No Liability for Security Breaches:</strong> We are not responsible if your application, system, or data 
                suffers a security breach, hack, data leak, or unauthorized access, even if you used the Service for security testing.</p>

                <p><strong>3.3 Exclusion of Consequential Damages:</strong> In no event shall we be liable for any indirect, incidental, 
                special, consequential, or punitive damages, including but not limited to loss of profits, data, use, goodwill, or other 
                intangible losses resulting from:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Use or inability to use the Service</li>
                  <li>Unauthorized access to or alteration of your data</li>
                  <li>Any conduct or content of any third party on the Service</li>
                  <li>Any content obtained from the Service</li>
                  <li>Security vulnerabilities not detected by the Service</li>
                </ul>

                <p><strong>3.4 Maximum Liability Cap:</strong> Our total liability to you for all claims arising from or related to the Service 
                shall not exceed the amount you paid us, if any, in the twelve (12) months preceding the claim. If you have not paid us any fees, 
                our liability is limited to $100 USD.</p>
              </div>
            </section>

            {/* 4. Disclaimer of Warranties */}
            <section>
              <h3 className="font-bold text-base mb-2">4. DISCLAIMER OF WARRANTIES</h3>
              <div className="space-y-2">
                <p className="font-semibold uppercase">
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
                </p>

                <p>We expressly disclaim all warranties, including but not limited to:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Warranties of merchantability</li>
                  <li>Fitness for a particular purpose</li>
                  <li>Non-infringement</li>
                  <li>Accuracy or reliability of AI-generated content</li>
                  <li>Uninterrupted or error-free operation</li>
                  <li>Security or freedom from viruses or harmful components</li>
                  <li>Accuracy of any recommendations or assessments</li>
                </ul>

                <p>No advice or information, whether oral or written, obtained by you from us or through the Service shall create any 
                warranty not expressly stated in these Terms.</p>
              </div>
            </section>

            {/* 5. User Responsibilities */}
            <section>
              <h3 className="font-bold text-base mb-2">5. USER RESPONSIBILITIES</h3>
              <div className="space-y-2">
                <p><strong>5.1 Proper Use:</strong> You are solely responsible for:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Ensuring you have authorization to test the applications and systems you scan</li>
                  <li>Validating all AI-generated findings with qualified security professionals</li>
                  <li>Testing all AI-generated code fixes in non-production environments first</li>
                  <li>Implementing proper security controls independent of this Service</li>
                  <li>Maintaining backups of all code and data</li>
                  <li>Complying with all applicable laws and regulations</li>
                </ul>

                <p><strong>5.2 Prohibited Uses:</strong> You may not:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Use the Service to test systems you don't own or have permission to test</li>
                  <li>Rely solely on the Service for compliance with security regulations</li>
                  <li>Deploy AI-generated fixes to production without proper testing and review</li>
                  <li>Use the Service for illegal, harmful, or malicious purposes</li>
                  <li>Attempt to reverse engineer, decompile, or extract the AI models</li>
                </ul>

                <p><strong>5.3 Indemnification:</strong> You agree to indemnify, defend, and hold harmless us, our officers, directors, 
                employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Your use or misuse of the Service</li>
                  <li>Your violation of these Terms</li>
                  <li>Your violation of any rights of another party</li>
                  <li>Security breaches or vulnerabilities in your applications</li>
                  <li>Implementation of AI-generated code or recommendations</li>
                </ul>
              </div>
            </section>

            {/* 6. Data & Privacy */}
            <section>
              <h3 className="font-bold text-base mb-2">6. DATA & PRIVACY</h3>
              <div className="space-y-2">
                <p><strong>6.1 Data Processing:</strong> By using the Service, you acknowledge that we may process, analyze, and store 
                your code, application data, and scan results to provide the Service and improve our AI models.</p>

                <p><strong>6.2 Sensitive Information:</strong> Do not upload code or applications containing highly sensitive data, trade secrets, 
                or personal identifiable information (PII) unless you have implemented appropriate safeguards.</p>

                <p><strong>6.3 No Confidentiality Guarantee:</strong> While we implement reasonable security measures, we cannot guarantee 
                the confidentiality or security of data transmitted to or stored by the Service.</p>
              </div>
            </section>

            {/* 7. Modifications to Service & Terms */}
            <section>
              <h3 className="font-bold text-base mb-2">7. MODIFICATIONS TO SERVICE & TERMS</h3>
              <p className="mb-2">
                We reserve the right to modify, suspend, or discontinue the Service (or any part thereof) at any time without notice. 
                We may also update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of 
                the modified Terms.
              </p>
              <p>
                We are not liable to you or any third party for any modification, suspension, or discontinuance of the Service.
              </p>
            </section>

            {/* 8. Third-Party Services */}
            <section>
              <h3 className="font-bold text-base mb-2">8. THIRD-PARTY SERVICES & AI PROVIDERS</h3>
              <p className="mb-2">
                The Service may use third-party AI providers (such as OpenAI) and other external services. Your use of the Service is 
                subject to the terms and policies of these third-party providers. We are not responsible for the availability, accuracy, 
                or reliability of third-party services.
              </p>
            </section>

            {/* 9. Governing Law & Dispute Resolution */}
            <section>
              <h3 className="font-bold text-base mb-2">9. GOVERNING LAW & DISPUTE RESOLUTION</h3>
              <p className="mb-2">
                These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its 
                conflict of law provisions. Any disputes arising from these Terms or the Service shall be resolved through binding arbitration 
                in accordance with the rules of [Arbitration Association].
              </p>
              <p>
                You waive any right to a jury trial and any right to participate in a class action lawsuit.
              </p>
            </section>

            {/* 10. Miscellaneous */}
            <section>
              <h3 className="font-bold text-base mb-2">10. MISCELLANEOUS</h3>
              <div className="space-y-2">
                <p><strong>10.1 Entire Agreement:</strong> These Terms constitute the entire agreement between you and us regarding the Service.</p>

                <p><strong>10.2 Severability:</strong> If any provision of these Terms is found to be unenforceable, the remaining provisions 
                will remain in full force and effect.</p>

                <p><strong>10.3 No Waiver:</strong> Our failure to enforce any right or provision of these Terms will not be considered a waiver 
                of those rights.</p>

                <p><strong>10.4 Assignment:</strong> You may not assign or transfer these Terms without our prior written consent. We may assign 
                our rights and obligations without restriction.</p>
              </div>
            </section>

            {/* 11. Contact Information */}
            <section>
              <h3 className="font-bold text-base mb-2">11. CONTACT INFORMATION</h3>
              <p>
                If you have questions about these Terms, please contact us at: support@aithonshield.com
              </p>
            </section>

            {/* AI-Powered Service Notice */}
            <section className="p-4 bg-muted rounded-lg border">
              <h3 className="font-bold text-base mb-2">IMPORTANT: AI-POWERED SERVICE NOTICE</h3>
              <div className="space-y-2">
                <p>
                  Aithon Shield is an <strong>AI-powered security testing platform</strong>. All security scans, vulnerability assessments, 
                  risk analyses, remediation suggestions, and code fixes are generated through artificial intelligence and machine learning algorithms. 
                  <strong> These results are not guaranteed to be accurate, complete, or suitable for production use.</strong>
                </p>
                <p className="font-semibold">
                  By using this service, you acknowledge that all AI-generated outputs should be independently verified by qualified security professionals 
                  before implementation.
                </p>
              </div>
            </section>

            {/* Final Acknowledgment */}
            <div className="p-4 bg-muted rounded-lg border-2 border-primary/50">
              <h3 className="font-bold text-base mb-2">ACKNOWLEDGMENT</h3>
              <p className="text-sm">
                BY CLICKING "I ACCEPT" BELOW, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS OF SERVICE. 
                YOU SPECIFICALLY ACKNOWLEDGE AND AGREE THAT:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-sm">
                <li>This is an AI-powered service with no guarantees of accuracy</li>
                <li>All AI-generated content must be independently verified</li>
                <li>We are not liable for any damages arising from your use of the Service</li>
                <li>You use the Service entirely at your own risk</li>
                <li>You are responsible for validating and testing all AI-generated fixes</li>
              </ul>
            </div>
          </div>
        </ScrollArea>

        <Separator />

        <div className="space-y-4 pt-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms-read"
              checked={hasRead}
              onCheckedChange={(checked) => setHasRead(checked as boolean)}
              data-testid="checkbox-terms-read"
            />
            <label
              htmlFor="terms-read"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              I have read and understood the Terms of Service and Legal Disclaimer
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              onClick={handleAccept}
              disabled={!hasRead || isAccepting}
              className="min-w-32"
              data-testid="button-accept-terms"
            >
              {isAccepting ? "Processing..." : "I Accept"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
