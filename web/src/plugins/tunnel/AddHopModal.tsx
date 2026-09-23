import React, { useState } from 'react';
import { HopConfig, HopType } from './types';
import { Modal, Input, Select, Button } from '../../design-system';

export interface AddHopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddHop: (hop: HopConfig) => void;
}

export const AddHopModal: React.FC<AddHopModalProps> = ({ isOpen, onClose, onAddHop }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<HopType>('ssh_bastion');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [surrogateHandle, setSurrogateHandle] = useState('');
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !host) return;
    onAddHop({
      id: `hop-${Date.now().toString().slice(-4)}`,
      name,
      type,
      host,
      port: Number(port),
      auth: { username: username || undefined, surrogate_handle: surrogateHandle || undefined },
      timeout_ms: 5000,
    });
    setName(''); setHost(''); setSurrogateHandle(''); setUsername('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Multi-Hop Node" description="Configure a direct socket, SOCKS5 proxy, or SSH bastion to route network traffic.">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <Input label="Hop Node Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Frankfurt SSH Bastion" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Hop Protocol Type" value={type} onChange={(e) => {
            const newType = e.target.value as HopType;
            setType(newType);
            if (newType === 'ssh_bastion') setPort(22);
            else if (newType === 'socks5_proxy') setPort(1080);
            else if (newType === 'http_proxy') setPort(8080);
            else setPort(80);
          }}>
            <option value="ssh_bastion">SSH Bastion Gateway</option>
            <option value="socks5_proxy">SOCKS5 Proxy</option>
            <option value="http_proxy">HTTP Connect Proxy</option>
            <option value="direct">Direct Socket</option>
          </Select>
          <Input label="Port Number" type="number" required value={port} onChange={(e) => setPort(Number(e.target.value))} placeholder="22" />
        </div>
        <Input label="Host / Endpoint IP or Domain" required value={host} onChange={(e) => setHost(e.target.value)} placeholder="bastion-eu-central.corp.internal" />
        <Input label="SSH / Proxy Username (Optional)" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ubuntu / ec2-user" />
        <Input label="Surrogate Secret Handle (from ZK Vault)" value={surrogateHandle} onChange={(e) => setSurrogateHandle(e.target.value)} placeholder="$CORTEX_HANDLE:bastion_ssh_key$" />
        <div className="pt-2">
          <Button type="submit" fullWidth size="md">Save Hop Node</Button>
        </div>
      </form>
    </Modal>
  );
};
