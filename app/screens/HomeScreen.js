import { View, Text, Button } from 'react-native';

function HomeScreen({ navigation }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Ekran startowy</Text>
      <Button title="Idź do Szczegółów" onPress={() => navigation.navigate('Details')} />
    </View>
  );
}