import { MainHeader, Text, Space, Container, A, MoreExperiments } from 'jbx';

import DrosteApp from '@/components/DrosteApp.jsx';

export default function Page() {
  return (
    <Container>
      <MainHeader>Droste Creator</MainHeader>
      <Space h={1} />
      <Text>
        Create recursive images with the droste effect. Drag the four handles to
        choose the region that repeats into itself.
      </Text>

      <Space h={2} />

      <DrosteApp />

      <Space h={2} />

      <MoreExperiments exclude="droste-creator" />

      <Space h={2} />
      <Text>
        Made by <A href="https://javier.xyz">Javier Bórquez</A>. Online since
        2021.
      </Text>
    </Container>
  );
}
