import { render } from 'solid-js/web';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/solid-router';
import { StudioProvider } from './state';
import { StudioShell } from './shell';
import { Library } from './features/library';
import { WorkspacePage } from './features/workspace';
import { TransferProvider } from './transfers';
import { TransferQueue, StorageServers } from './features/transfer-pages';
import { ReviewInbox } from './features/review-inbox';
import { TripsPage, TravelMapPage } from './features/trips';
import './reset.css';

const rootRoute = createRootRoute({ component: StudioShell });
const paths = [
  '/',
  '/library',
  '/library/favorites',
  '/library/recent',
  '/imports',
  '/servers',
  '/studio',
  '/adventures',
  '/reviews',
  '/map',
  '/memories',
  '/ai',
  '/planner',
  '/publications',
  '/insights',
  '/extensions',
  '/settings',
  '/dev/ui',
] as const;
const children = paths.map((path) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    component:
      path === '/' || path.includes('library') || path.includes('collections')
        ? Library
        : path === '/imports'
          ? TransferQueue
          : path === '/servers'
            ? StorageServers
            : path === '/reviews'
              ? ReviewInbox
              : path === '/map'
                ? TravelMapPage
                : path.startsWith('/adventures') || path === '/planner'
                  ? TripsPage
                  : WorkspacePage,
  }),
);
const router = createRouter({
  routeTree: rootRoute.addChildren([
    ...children,
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/collections/$collectionId',
      component: Library,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/adventures/$tripId',
      component: TripsPage,
    }),
  ]),
  defaultNotFoundComponent: () => <WorkspacePage notFound />,
});
declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
render(
  () => (
    <QueryClientProvider client={queryClient}>
      <StudioProvider>
        <TransferProvider>
          <RouterProvider router={router} />
        </TransferProvider>
      </StudioProvider>
    </QueryClientProvider>
  ),
  document.getElementById('root')!,
);
