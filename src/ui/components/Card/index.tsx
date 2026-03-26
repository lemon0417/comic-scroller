import type { HTMLAttributes, ImgHTMLAttributes, ReactNode } from "react";

function mergeClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

function CardRoot({ className, children, ...rest }: CardProps) {
  return (
    <div className={mergeClasses("ds-card", className)} {...rest}>
      {children}
    </div>
  );
}

type CardCoverProps = ImgHTMLAttributes<HTMLImageElement> & {
  alt?: string;
};

function CardCover({ className, alt = "", ...rest }: CardCoverProps) {
  return (
    <img
      className={mergeClasses("ds-card-cover", className)}
      alt={alt}
      {...rest}
    />
  );
}

type CardBodyProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

function CardBody({ className, children, ...rest }: CardBodyProps) {
  return (
    <div className={mergeClasses("ds-card-body", className)} {...rest}>
      {children}
    </div>
  );
}

type CardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

function CardHeader({ className, children, ...rest }: CardHeaderProps) {
  return (
    <div className={mergeClasses("ds-card-header", className)} {...rest}>
      {children}
    </div>
  );
}

type CardTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  children?: ReactNode;
};

function CardTitle({ className, children, ...rest }: CardTitleProps) {
  return (
    <h1 className={mergeClasses("ds-card-title", className)} {...rest}>
      {children}
    </h1>
  );
}

type CardMetaProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

function CardMeta({ className, children, ...rest }: CardMetaProps) {
  return (
    <div className={mergeClasses("ds-card-meta", className)} {...rest}>
      {children}
    </div>
  );
}

type CardLinkProps = HTMLAttributes<HTMLSpanElement> & {
  children?: ReactNode;
};

function CardLink({ className, children, ...rest }: CardLinkProps) {
  return (
    <span className={mergeClasses("ds-card-link", className)} {...rest}>
      {children}
    </span>
  );
}

type CardActionProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

function CardAction({ className, children, ...rest }: CardActionProps) {
  return (
    <div className={mergeClasses("group ds-card-action", className)} {...rest}>
      {children}
    </div>
  );
}

type CardComponent = typeof CardRoot & {
  Cover: typeof CardCover;
  Body: typeof CardBody;
  Header: typeof CardHeader;
  Title: typeof CardTitle;
  Meta: typeof CardMeta;
  Link: typeof CardLink;
  Action: typeof CardAction;
};

const Card = Object.assign(CardRoot, {
  Cover: CardCover,
  Body: CardBody,
  Header: CardHeader,
  Title: CardTitle,
  Meta: CardMeta,
  Link: CardLink,
  Action: CardAction,
}) as CardComponent;

export default Card;
export {
  CardAction,
  CardBody,
  CardCover,
  CardHeader,
  CardLink,
  CardMeta,
  CardTitle,
};
