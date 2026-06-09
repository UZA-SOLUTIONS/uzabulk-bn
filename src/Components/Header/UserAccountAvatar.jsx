import React, { useEffect, useState } from "react";
import { getUserAvatarUrl, getUserInitials } from "../../helpers/commonHelper";

export default function UserAccountAvatar({ user, className = "", size = 32 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const avatarUrl = getUserAvatarUrl(user);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);
  const showImage = Boolean(avatarUrl) && !imgFailed;
  const initials = getUserInitials(user);
  const dim = `${size}px`;

  return (
    <span
      className={`user-account-avatar${className ? ` ${className}` : ""}`}
      style={{ width: dim, height: dim }}
      aria-hidden={showImage ? undefined : true}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="user-account-avatar__initials">{initials}</span>
      )}
    </span>
  );
}
