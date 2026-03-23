import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function CookiePolicy() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} aria-label="Go back to dashboard" data-testid="button-back-cookie">
          <ArrowLeft aria-hidden="true" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-cookie-policy">Cookie Policy</h1>
          <p className="text-muted-foreground mt-1">How we use cookies and similar technologies</p>
        </div>
        <Badge variant="outline" className="ml-auto">Last Updated: February 2026</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. What Are Cookies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work more efficiently and to provide information to the site owners. Cookies allow the website to recognize your device and remember certain information about your session.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. How We Use Cookies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">2.1 Essential Cookies (Required)</h3>
            <p className="mb-2">These cookies are strictly necessary for the Service to function and cannot be disabled:</p>
            <ul className="list-disc pl-6 space-y-1" role="list">
              <li><strong>Session Cookie:</strong> Maintains your authentication state while you are logged in. This cookie is deleted when you log out or your session expires.</li>
              <li><strong>CSRF Token:</strong> Prevents cross-site request forgery attacks to protect your account security.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2.2 Functional Cookies</h3>
            <p className="mb-2">These cookies enable enhanced functionality and personalization:</p>
            <ul className="list-disc pl-6 space-y-1" role="list">
              <li><strong>Theme Preference:</strong> Remembers your selected theme (light or dark mode) between visits.</li>
              <li><strong>Sidebar State:</strong> Remembers whether the sidebar is expanded or collapsed.</li>
              <li><strong>Notification Preferences:</strong> Stores your push notification settings.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2.3 Performance Cookies</h3>
            <p>
              We may use performance cookies to understand how users interact with the Service. These cookies collect aggregated, anonymous information and help us improve our Service.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Third-Party Cookies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>The following third-party services may set cookies when you use our Service:</p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li><strong>Stripe:</strong> When you interact with payment forms, Stripe may set cookies for fraud prevention and payment processing. Please refer to <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Stripe's Privacy Policy</a> for details.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Local Storage & Session Storage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>In addition to cookies, we use browser local storage and session storage for:</p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li><strong>Theme Settings:</strong> Your dark/light mode preference</li>
            <li><strong>Push Notification Subscription:</strong> Web push notification registration data</li>
            <li><strong>Terms Acceptance:</strong> Record of your Terms of Service acceptance</li>
            <li><strong>UI State:</strong> Various interface preferences for a better user experience</li>
          </ul>
          <p>
            Local storage data persists until you clear your browser data. Session storage data is cleared when you close the browser tab.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Managing Cookies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            You can manage cookies through your browser settings. Most browsers allow you to:
          </p>
          <ul className="list-disc pl-6 space-y-2" role="list">
            <li>View what cookies are stored and delete individual cookies</li>
            <li>Block third-party cookies</li>
            <li>Block all cookies from specific sites</li>
            <li>Block all cookies from being set</li>
            <li>Delete all cookies when you close the browser</li>
          </ul>
          <p className="mt-4">
            <strong>Please note:</strong> Blocking essential cookies will prevent you from logging in and using the Service. The authentication session cookie is required for the application to function.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6. Cookie Consent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            By using Aithon Shield, you consent to the use of essential cookies as described in this policy. Essential cookies are necessary for the Service to function and do not require separate consent under most privacy regulations, including GDPR.
          </p>
          <p>
            For non-essential cookies, we will request your consent before setting them, where required by applicable law.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>7. Changes to This Cookie Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            We may update this Cookie Policy from time to time to reflect changes in our practices or applicable law. We will post the updated policy on this page and update the "Last Updated" date.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>8. Contact Us</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>If you have questions about our use of cookies, please contact us at:</p>
          <ul className="list-none space-y-1" role="list">
            <li>Email: <a href="mailto:privacy@aithonshield.com" className="text-primary hover:underline" data-testid="link-cookie-email">privacy@aithonshield.com</a></li>
            <li>Support: <a href="mailto:support@aithonshield.com" className="text-primary hover:underline">support@aithonshield.com</a></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
