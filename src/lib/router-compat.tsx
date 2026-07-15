"use client";

/**
 * Thin react-router-dom compatibility layer over next/navigation.
 * Exists so ported pages keep IDENTICAL logic. New code may use
 * next/navigation directly.
 */
import NextLink from "next/link";
import {
  usePathname,
  useRouter,
  useParams as useNextParams,
  useSearchParams as useNextSearchParams,
} from "next/navigation";
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  type AnchorHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";

/** react-router `location.state` emulation (in-memory, per-tab like the SPA). */
let navigationState: unknown = null;

export interface Location {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
  key: string;
}

export function useLocation(): Location {
  const pathname = usePathname() ?? "/";
  const sp = useNextSearchParams();
  const search = sp?.toString() ?? "";
  return useMemo(
    () => ({
      pathname,
      search: search ? `?${search}` : "",
      hash: typeof window !== "undefined" ? window.location.hash : "",
      state: navigationState,
      key: "default",
    }),
    [pathname, search]
  );
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  return (useNextParams() ?? {}) as T;
}

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export type NavigateFunction = {
  (to: string, options?: NavigateOptions): void;
  (delta: number): void;
};

export function useNavigate(): NavigateFunction {
  const router = useRouter();
  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        if (to < 0) router.back();
        else router.forward();
        return;
      }
      navigationState = options && "state" in options ? options.state : null;
      if (options?.replace) router.replace(to);
      else router.push(to);
    },
    [router]
  ) as NavigateFunction;
}

type SetSearchParamsInput =
  | URLSearchParams
  | Record<string, string>
  | string
  | ((prev: URLSearchParams) => URLSearchParams | Record<string, string> | string);

export function useSearchParams(): [URLSearchParams, (next: SetSearchParamsInput, opts?: { replace?: boolean }) => void] {
  const sp = useNextSearchParams();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const params = useMemo(() => new URLSearchParams(sp?.toString() ?? ""), [sp]);
  const setParams = useCallback(
    (next: SetSearchParamsInput, opts?: { replace?: boolean }) => {
      const resolved =
        typeof next === "function" ? next(new URLSearchParams(window.location.search)) : next;
      const usp = resolved instanceof URLSearchParams ? resolved : new URLSearchParams(resolved);
      const qs = usp.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      // react-router default is a push navigation
      if (opts?.replace) router.replace(url);
      else router.push(url);
    },
    [pathname, router]
  );
  return [params, setParams];
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  replace?: boolean;
  state?: unknown;
  children?: ReactNode;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, state, onClick, ...rest },
  ref
) {
  return (
    <NextLink
      ref={ref}
      href={to}
      replace={replace}
      onClick={(e) => {
        navigationState = state ?? null;
        onClick?.(e as never);
      }}
      {...rest}
    />
  );
});

interface NavLinkRenderArgs {
  isActive: boolean;
  isPending: boolean;
  isTransitioning: boolean;
}

export interface NavLinkProps extends Omit<LinkProps, "className" | "style" | "children"> {
  end?: boolean;
  caseSensitive?: boolean;
  className?: string | ((args: NavLinkRenderArgs) => string | undefined);
  style?: CSSProperties | ((args: NavLinkRenderArgs) => CSSProperties | undefined);
  children?: ReactNode | ((args: NavLinkRenderArgs) => ReactNode);
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { to, end, caseSensitive, className, style, children, ...rest },
  ref
) {
  const pathname = usePathname() ?? "/";
  let target = to.split("?")[0].split("#")[0];
  let current = pathname;
  if (!caseSensitive) {
    target = target.toLowerCase();
    current = current.toLowerCase();
  }
  const isActive =
    current === target || (!end && target !== "/" && current.startsWith(target.endsWith("/") ? target : target + "/"));
  const args: NavLinkRenderArgs = { isActive, isPending: false, isTransitioning: false };
  return (
    <Link
      ref={ref}
      to={to}
      aria-current={isActive ? "page" : undefined}
      className={typeof className === "function" ? className(args) : className}
      style={typeof style === "function" ? style(args) : style}
      {...rest}
    >
      {typeof children === "function" ? children(args) : children}
    </Link>
  );
});

export function Navigate({ to, replace, state }: { to: string; replace?: boolean; state?: unknown }) {
  const router = useRouter();
  useEffect(() => {
    navigationState = state ?? null;
    if (replace) router.replace(to);
    else router.push(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
