import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle2, Mail, Phone, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function AccessibilityStatement() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} aria-label="Go back to dashboard" data-testid="button-back-accessibility">
          <ArrowLeft aria-hidden="true" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-accessibility-statement">Accessibility Statement</h1>
          <p className="text-muted-foreground mt-1">Our commitment to digital accessibility for all users</p>
        </div>
        <Badge variant="outline" className="ml-auto">Last Updated: February 2026</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
            Our Commitment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Aithon Shield is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards to ensure we provide equal access to all users.
          </p>
          <p>
            We strive to conform to the Web Content Accessibility Guidelines (WCAG) 2.1, Level AA, as published by the World Wide Web Consortium (W3C). These guidelines explain how to make web content more accessible for people with disabilities and more user-friendly for everyone.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conformance Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Aithon Shield aims to conform to <strong>WCAG 2.1 Level AA</strong>. This means the content conforms to the accessibility standard with the following measures:
          </p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li><strong>Perceivable:</strong> Information and user interface components are presented in ways that all users can perceive, including users who rely on assistive technologies.</li>
            <li><strong>Operable:</strong> All user interface components and navigation are operable via keyboard, mouse, and assistive technology.</li>
            <li><strong>Understandable:</strong> Information and the operation of the user interface are understandable, with clear labels, instructions, and error identification.</li>
            <li><strong>Robust:</strong> Content is robust enough to be reliably interpreted by a wide variety of user agents, including assistive technologies.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accessibility Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: "Keyboard Navigation", desc: "All interactive elements are accessible via keyboard. A visible focus indicator is provided on all focusable elements." },
              { title: "Skip Navigation", desc: "A 'Skip to main content' link is provided to allow keyboard users to bypass repetitive navigation elements." },
              { title: "Screen Reader Support", desc: "Semantic HTML, ARIA landmarks, labels, and live regions are used to provide a meaningful experience for screen reader users." },
              { title: "Color Contrast", desc: "Text and interactive elements meet or exceed WCAG 2.1 AA minimum contrast ratios of 4.5:1 for normal text and 3:1 for large text." },
              { title: "Reduced Motion", desc: "The application respects the user's 'prefers-reduced-motion' system setting, disabling animations for users who request it." },
              { title: "Text Resizing", desc: "Content is designed to be readable and functional when text is resized up to 200% without loss of content or functionality." },
              { title: "Form Accessibility", desc: "All form inputs have associated labels, error messages are clearly communicated, and required fields are identified." },
              { title: "Alternative Text", desc: "All meaningful images include descriptive alternative text. Decorative images are marked to be ignored by screen readers." },
              { title: "Focus Management", desc: "Focus is managed appropriately during dialog interactions and page navigation to maintain context for keyboard and screen reader users." },
              { title: "Consistent Navigation", desc: "Navigation mechanisms are consistent across pages, allowing users to predict where to find information." },
              { title: "Error Identification", desc: "Form validation errors are clearly identified in text, associated with specific fields, and communicated to assistive technologies." },
              { title: "Responsive Design", desc: "The application is fully responsive and functional across desktop, tablet, and mobile screen sizes." },
            ].map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-md bg-muted/30">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium text-sm">{feature.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Standards & Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>This application is designed to comply with the following standards and regulations:</p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li><strong>WCAG 2.1 Level AA</strong> - Web Content Accessibility Guidelines published by the W3C Web Accessibility Initiative (WAI)</li>
            <li><strong>ADA Title III</strong> - Americans with Disabilities Act, Title III (Public Accommodations), as applicable to web-based services</li>
            <li><strong>Section 508</strong> - Section 508 of the Rehabilitation Act, as applicable to electronic and information technology</li>
            <li><strong>EN 301 549</strong> - European Standard for ICT Accessibility, as applicable to web-based services</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assistive Technologies Supported</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Aithon Shield is designed to be compatible with the following assistive technologies:</p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li>Screen readers (JAWS, NVDA, VoiceOver, TalkBack)</li>
            <li>Screen magnification software</li>
            <li>Speech recognition software (Dragon NaturallySpeaking)</li>
            <li>Keyboard-only navigation</li>
            <li>Switch devices and alternative input methods</li>
            <li>High contrast and custom color modes</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Known Limitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            While we strive for full accessibility, some content may have limitations due to the complexity of security data visualizations. We are actively working to improve these areas:
          </p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li><strong>Complex Data Visualizations:</strong> Some charts and graphs may not be fully accessible to screen readers. We provide alternative text descriptions and data tables where possible.</li>
            <li><strong>Third-Party Content:</strong> Some content generated by third-party AI services may not meet all accessibility standards. We review and improve these outputs regularly.</li>
            <li><strong>PDF Reports:</strong> Generated PDF reports aim for accessibility but may have limitations. We recommend using the on-screen report viewer for the best accessible experience.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feedback & Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            We welcome your feedback on the accessibility of Aithon Shield. If you encounter accessibility barriers or have suggestions for improvement, please contact us:
          </p>
          <div className="space-y-3 mt-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <a href="mailto:accessibility@aithonshield.com" className="text-sm text-primary hover:underline" data-testid="link-accessibility-email">
                  accessibility@aithonshield.com
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <a href="tel:+18005551234" className="text-sm text-primary hover:underline" data-testid="link-accessibility-phone">
                  1-800-555-1234 (Accessibility Support)
                </a>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            We aim to respond to accessibility feedback within 2 business days. If you need immediate assistance, please call our accessibility support line during business hours (Monday-Friday, 9 AM - 5 PM EST).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enforcement Procedures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            If you are not satisfied with our response to your accessibility concern, you may file a complaint with the relevant regulatory body in your jurisdiction. In the United States, you may contact:
          </p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li>The U.S. Department of Justice, Civil Rights Division, Disability Rights Section</li>
            <li>The U.S. Access Board</li>
            <li>Your state's Attorney General office</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
