"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Bell,
  Shield,
  Palette,
  Clock,
  Save,
  Key,
  Mail,
} from "lucide-react";

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <>
      <Header
        title="Settings"
        description="Manage your account and application preferences"
      />

      <div className="p-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Prefs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your personal information and email settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                    JD
                  </div>
                  <div>
                    <Button variant="outline" size="sm">
                      Change Avatar
                    </Button>
                    <p className="text-sm text-muted-foreground mt-1">
                      JPG, PNG or GIF. Max 2MB.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" defaultValue="John" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" defaultValue="Doe" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-9"
                      defaultValue="john.doe@school.edu"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" defaultValue="+91 9876543210" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select defaultValue="cs">
                    <SelectTrigger id="department">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cs">Computer Science</SelectItem>
                      <SelectItem value="it">Information Technology</SelectItem>
                      <SelectItem value="ec">Electronics</SelectItem>
                      <SelectItem value="me">Mechanical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>
                  Configure how you want to receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {[
                    {
                      title: "Viva Completion",
                      description: "Get notified when a student completes a viva",
                      defaultChecked: true,
                    },
                    {
                      title: "Low Score Alerts",
                      description:
                        "Alert when a student scores below passing threshold",
                      defaultChecked: true,
                    },
                    {
                      title: "Daily Summary",
                      description: "Receive daily summary of all viva activities",
                      defaultChecked: false,
                    },
                    {
                      title: "Weekly Report",
                      description:
                        "Detailed weekly performance report via email",
                      defaultChecked: true,
                    },
                    {
                      title: "System Updates",
                      description: "Notifications about system updates and maintenance",
                      defaultChecked: false,
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <h4 className="font-medium">{item.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          defaultChecked={item.defaultChecked}
                        />
                        <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Preferences"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>
                  Manage your password and security preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="currentPassword"
                        type="password"
                        className="pl-9"
                        placeholder="Enter current password"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="newPassword"
                        type="password"
                        className="pl-9"
                        placeholder="Enter new password"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        className="pl-9"
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <h4 className="font-medium">Password Requirements</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• At least 8 characters long</li>
                    <li>• Contains at least one uppercase letter</li>
                    <li>• Contains at least one number</li>
                    <li>• Contains at least one special character</li>
                  </ul>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving}>
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences">
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle>Application Preferences</CardTitle>
                <CardDescription>
                  Customize your application experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select defaultValue="en">
                      <SelectTrigger id="language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="hi">Hindi</SelectItem>
                        <SelectItem value="ta">Tamil</SelectItem>
                        <SelectItem value="te">Telugu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Select defaultValue="ist">
                        <SelectTrigger id="timezone" className="pl-9">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ist">
                            IST (India Standard Time)
                          </SelectItem>
                          <SelectItem value="utc">UTC</SelectItem>
                          <SelectItem value="pst">
                            PST (Pacific Standard Time)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">Date Format</Label>
                    <Select defaultValue="dd-mm-yyyy">
                      <SelectTrigger id="dateFormat">
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dd-mm-yyyy">DD/MM/YYYY</SelectItem>
                        <SelectItem value="mm-dd-yyyy">MM/DD/YYYY</SelectItem>
                        <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select defaultValue="light">
                      <SelectTrigger id="theme">
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultSubject">Default Subject Filter</Label>
                  <Select defaultValue="all">
                    <SelectTrigger id="defaultSubject">
                      <SelectValue placeholder="Select default subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subjects</SelectItem>
                      <SelectItem value="ds">Data Structures</SelectItem>
                      <SelectItem value="dbms">DBMS</SelectItem>
                      <SelectItem value="os">Operating Systems</SelectItem>
                      <SelectItem value="cn">Computer Networks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Preferences"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}


