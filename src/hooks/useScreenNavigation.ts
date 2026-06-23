import { useCallback, useReducer } from "react";

type NavigationState<Screen extends string> = {
  current: Screen;
  history: Screen[];
};

type NavigationAction<Screen extends string> =
  | { type: "navigate"; target: Screen; root: boolean; rootScreen: Screen }
  | { type: "back"; rootScreen: Screen }
  | { type: "reset"; target: Screen };

export const navigationReducer = <Screen extends string>(
  state: NavigationState<Screen>,
  action: NavigationAction<Screen>,
): NavigationState<Screen> => {
  switch (action.type) {
    case "navigate":
      if (action.target === state.current) return state;

      return {
        current: action.target,
        history: action.root
          ? action.target === action.rootScreen
            ? []
            : [action.rootScreen]
          : [...state.history, state.current],
      };
    case "back":
      return {
        current: state.history.at(-1) ?? action.rootScreen,
        history: state.history.slice(0, -1),
      };
    case "reset":
      return { current: action.target, history: [] };
  }
};

export const useScreenNavigation = <Screen extends string>(
  rootScreen: Screen,
) => {
  const [state, dispatch] = useReducer(navigationReducer<Screen>, {
    current: rootScreen,
    history: [],
  });

  const navigateTo = useCallback(
    (target: Screen, { root = false }: { root?: boolean } = {}) => {
      dispatch({ type: "navigate", target, root, rootScreen });
    },
    [rootScreen],
  );

  const navigateBack = useCallback(() => {
    dispatch({ type: "back", rootScreen });
  }, [rootScreen]);

  const navigateRoot = useCallback(() => {
    dispatch({ type: "reset", target: rootScreen });
  }, [rootScreen]);

  return {
    currentScreen: state.current,
    navigateTo,
    navigateBack,
    navigateRoot,
  };
};
