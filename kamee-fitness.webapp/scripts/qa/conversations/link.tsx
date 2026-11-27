import React from 'react';
export default function LocalLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={href} onClick={event => event.preventDefault()}>{children}</a>;
}
export function useLinkStatus() { return { pending: false }; }
