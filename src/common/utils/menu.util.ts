export const mapMenus = (permissions: any[]): any[] => {
  const flatMenus =
    permissions
      ?.map((p: any) => {
        const sanitizedActions =
          p.actions && p.actions.length > 0 ? p.actions : ['view'];

        return {
          id: p.menu?.id,
          parentId: p.menu?.parent?.id || null,
          name: p.menu?.name,
          path: p.menu?.url,
          icon: p.menu?.icon,
          order_no: p.menu?.order_no || 0,
          actions: sanitizedActions,
        };
      })
      .filter((m) => m.id) || [];

  const menuMap = new Map();
  const tree: any[] = [];

  flatMenus.forEach((item) => {
    menuMap.set(item.id, { ...item, children: [] });
  });

  flatMenus.forEach((item) => {
    const node = menuMap.get(item.id);
    if (item.parentId && menuMap.has(item.parentId)) {
      menuMap.get(item.parentId).children.push(node);
    } else {
      tree.push(node);
    }
  });

  const finalTree = tree.sort((a, b) => a.order_no - b.order_no);

  if (!finalTree.some((m) => m.path === '/')) {
    finalTree.unshift({
      name: 'Home',
      path: '/',
      icon: 'home',
      actions: ['view'],
      children: [],
    });
  }

  return finalTree;
};
