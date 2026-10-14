import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "薄肌3.0｜个人健身与分享社区",
  description: "面向新加坡用户的个人健身计划、营养记录、运动进度和照片分享社区。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-SG"><body>{children}</body></html>;
}
