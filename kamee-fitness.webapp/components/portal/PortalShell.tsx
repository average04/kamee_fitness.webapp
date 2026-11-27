import type { ReactNode } from "react";
import { PortalSidebar, type PortalSidebarProps } from "./PortalSidebar";
import styles from "./portal.module.css";

export function PortalShell({ children, contentElement = "main", skipTargetId = "portal-content", ...sidebar }: PortalSidebarProps & {
  children: ReactNode;
  contentElement?: "main" | "div";
  skipTargetId?: string;
}) {
  const Content = contentElement;
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href={`#${skipTargetId}`}>Skip to content</a>
      <PortalSidebar {...sidebar} />
      <Content id={skipTargetId === "portal-content" ? skipTargetId : undefined} tabIndex={skipTargetId === "portal-content" ? -1 : undefined} className={`${styles.content} ${sidebar.surface === "admin" ? styles.adminContent : ""}`}>
        {children}
      </Content>
    </div>
  );
}
