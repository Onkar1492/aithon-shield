import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} aria-label="Go back to dashboard" data-testid="button-back-privacy">
          <ArrowLeft aria-hidden="true" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-privacy-policy">Privacy Policy</h1>
          <p className="text-muted-foreground mt-1">How we collect, use, and protect your information</p>
        </div>
        <Badge variant="outline" className="ml-auto">Last Updated: February 2026</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Introduction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Aithon Shield ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application and mobile application (collectively, the "Service").
          </p>
          <p>
            By accessing or using the Service, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree, please do not access or use the Service.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Information We Collect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">2.1 Personal Information</h3>
            <p className="mb-2">When you create an account, we collect:</p>
            <ul className="list-disc pl-6 space-y-1" role="list">
              <li>Email address</li>
              <li>First and last name</li>
              <li>Username</li>
              <li>Password (stored in encrypted/hashed form)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2.2 Application Data</h3>
            <p className="mb-2">When you use our scanning services, we process:</p>
            <ul className="list-disc pl-6 space-y-1" role="list">
              <li>Source code and application files submitted for scanning</li>
              <li>Repository URLs and branch information</li>
              <li>Application identifiers and version numbers</li>
              <li>Security scan results and vulnerability data</li>
              <li>AI-generated remediation suggestions and code fixes</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2.3 Usage Data</h3>
            <p className="mb-2">We automatically collect:</p>
            <ul className="list-disc pl-6 space-y-1" role="list">
              <li>Browser type and version</li>
              <li>Operating system</li>
              <li>IP address</li>
              <li>Pages visited and time spent</li>
              <li>Actions taken within the application (audit log)</li>
              <li>Session information</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2.4 Payment Information</h3>
            <p>
              Payment processing is handled by Stripe, a PCI-compliant third-party payment processor. We do not store credit card numbers or full payment details on our servers. We may retain transaction IDs and subscription status information.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. How We Use Your Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>We use the collected information for:</p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li><strong>Service Delivery:</strong> To provide security scanning, vulnerability analysis, and remediation services</li>
            <li><strong>Account Management:</strong> To create and manage your user account</li>
            <li><strong>AI Analysis:</strong> To generate security assessments, vulnerability reports, and code fix suggestions using AI models</li>
            <li><strong>Communication:</strong> To send scan completion notifications, security alerts, and service updates</li>
            <li><strong>Service Improvement:</strong> To improve our AI models, scanning accuracy, and user experience</li>
            <li><strong>Compliance:</strong> To comply with legal obligations and enforce our Terms of Service</li>
            <li><strong>Security:</strong> To detect, prevent, and address technical issues and security threats</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Data Sharing & Third Parties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>We may share your information with:</p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li><strong>AI Providers:</strong> Code and application data may be processed by third-party AI providers (such as OpenAI) to generate security assessments. Data sent to AI providers is subject to their respective privacy policies.</li>
            <li><strong>Payment Processors:</strong> Payment information is shared with Stripe for transaction processing.</li>
            <li><strong>Service Providers:</strong> We may use third-party services for hosting, analytics, and email delivery.</li>
            <li><strong>Legal Requirements:</strong> We may disclose information if required by law, regulation, legal process, or governmental request.</li>
          </ul>
          <p className="font-medium mt-4">We do NOT:</p>
          <ul className="list-disc pl-6 space-y-1" role="list">
            <li>Sell your personal information to third parties</li>
            <li>Use your code or scan data for advertising purposes</li>
            <li>Share your data with unrelated third parties for their marketing</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Data Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>We implement appropriate technical and organizational measures to protect your information, including:</p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li>Encryption of data in transit (TLS/SSL)</li>
            <li>Encryption of sensitive data at rest</li>
            <li>Password hashing using industry-standard algorithms (bcrypt)</li>
            <li>Session-based authentication with secure cookies</li>
            <li>Regular security assessments and updates</li>
            <li>Access controls and role-based permissions</li>
          </ul>
          <p>
            While we strive to protect your information, no method of transmission over the Internet or electronic storage is 100% secure. We cannot guarantee absolute security.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6. Data Retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>We retain your information as follows:</p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li><strong>Account Data:</strong> Retained as long as your account is active. Deleted upon account deletion request.</li>
            <li><strong>Scan Results:</strong> Retained for the duration of your account. Archived scans may be retained for up to 12 months after archival.</li>
            <li><strong>Audit Logs:</strong> Retained for up to 24 months for compliance and security purposes.</li>
            <li><strong>Payment Records:</strong> Retained as required by applicable financial regulations (typically 7 years).</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>7. Your Rights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Depending on your jurisdiction, you may have the following rights:</p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
            <li><strong>Correction:</strong> Request correction of inaccurate personal information</li>
            <li><strong>Deletion:</strong> Request deletion of your personal information (subject to legal retention requirements)</li>
            <li><strong>Portability:</strong> Request a machine-readable copy of your data</li>
            <li><strong>Objection:</strong> Object to certain types of data processing</li>
            <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances</li>
            <li><strong>Withdraw Consent:</strong> Withdraw consent for processing based on consent</li>
          </ul>
          <p>
            To exercise any of these rights, please contact us at{" "}
            <a href="mailto:privacy@aithonshield.com" className="text-primary hover:underline" data-testid="link-privacy-email">
              privacy@aithonshield.com
            </a>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>8. GDPR Compliance (EU/EEA Users)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>If you are located in the European Union or European Economic Area:</p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li>Our legal bases for processing include: contract performance, legitimate interests, consent, and legal obligations</li>
            <li>You have the right to lodge a complaint with your local supervisory authority</li>
            <li>Data transfers outside the EU/EEA are safeguarded by appropriate mechanisms (Standard Contractual Clauses)</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>9. CCPA Compliance (California Residents)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):</p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li>Right to know what personal information is collected, used, shared, or sold</li>
            <li>Right to delete personal information held by us</li>
            <li>Right to opt-out of the sale of personal information (we do not sell personal information)</li>
            <li>Right to non-discrimination for exercising your CCPA rights</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>10. Children's Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            The Service is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children under 18. If we become aware that we have collected data from a child under 18, we will take steps to delete such information.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>11. Changes to This Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. Your continued use of the Service after any changes constitutes acceptance of the updated Privacy Policy.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>12. Contact Us</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>If you have questions or concerns about this Privacy Policy, please contact us at:</p>
          <ul className="list-none space-y-1" role="list">
            <li>Email: <a href="mailto:privacy@aithonshield.com" className="text-primary hover:underline">privacy@aithonshield.com</a></li>
            <li>Support: <a href="mailto:support@aithonshield.com" className="text-primary hover:underline">support@aithonshield.com</a></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
