export const CATEGORIES_LIST = "uza-retail-categories";
export const MEGA_MENU_CATEGORIES = "uza-retail-mega-categories";
export const TOP_CATEGORIES = "uza-retail-top-categories";
export const SOURCE_APPLICATION = "uza-retail-source-categories";

export const getStorageList = (query) => {
    const { items, expire } = JSON.parse(localStorage.getItem(query) || "{}");

    if (expire) {
        const date = new Date(expire);
        if (date.getTime() < Date.now()) {
            return false;
        }
    }
    else {
        return false;
    }

    return items;
}


export const setStorageList = (query, list) => {
    const date = new Date();
    date.setHours(date.getHours() + 1);
    localStorage.setItem(query, JSON.stringify({ items: list, expire: date.getTime() }));
}