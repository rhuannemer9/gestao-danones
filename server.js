const express = require('express');
const cors = require('cors');
const ExcelJS = require('exceljs');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

async function registrarEntradaCaixaAutomatica({ syncId, categoria, descricao, valor, dataMovimento }) {
  const valorNumerico = Number(valor || 0);

  if (!valorNumerico || valorNumerico <= 0) {
    return;
  }

  if (syncId) {
    const { data: existente } = await supabase
      .from('caixa')
      .select('id')
      .eq('sync_id', syncId)
      .maybeSingle();

    if (existente) {
      return;
    }
  }

  await supabase
    .from('caixa')
    .insert([{
      id: Date.now() + Math.floor(Math.random() * 1000),
      sync_id: syncId || null,
      tipo: 'ENTRADA',
      categoria,
      descricao,
      valor: valorNumerico,
      data_movimento: dataMovimento || new Date().toISOString()
    }]);
}

async function obterClienteParaVenda({ clienteId, clienteNome, clienteAvulso }) {
  if (!clienteAvulso) {
    const { data: clienteEncontrado, error: erroCliente } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .single();

    if (erroCliente || !clienteEncontrado) {
      return {
        erro: 'Cliente nao encontrado'
      };
    }

    return {
      cliente: clienteEncontrado
    };
  }

  const nomeAvulso = clienteNome || 'Cliente Avulso';

  const { data: clienteExistente } = await supabase
    .from('clientes')
    .select('*')
    .eq('nome', nomeAvulso)
    .limit(1)
    .maybeSingle();

  if (clienteExistente) {
    return {
      cliente: clienteExistente
    };
  }

  const { data: clienteCriado, error: erroCriarCliente } = await supabase
    .from('clientes')
    .insert([{
      id: Date.now(),
      nome: nomeAvulso,
      telefone: '',
      endereco: '',
      observacoes: 'Cliente automatico para vendas pagas avulsas',
      criado_em: new Date().toISOString()
    }])
    .select()
    .single();

  if (erroCriarCliente || !clienteCriado) {
    return {
      erro: erroCriarCliente ? erroCriarCliente.message : 'Nao foi possivel criar Cliente Avulso'
    };
  }

  return {
    cliente: clienteCriado
  };
}

// LOGIN

app.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('usuario', usuario)
    .eq('senha', senha)
    .single();

  if (error || !data) {
    return res.status(401).json({ erro: 'Usuário ou senha incorretos' });
  }

  res.json({
    mensagem: 'Login realizado com sucesso',
    usuario: data.usuario
  });
});

app.post('/alterar-senha', async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;

  const { data: usuarioEncontrado, error: erroBusca } = await supabase
    .from('usuarios')
    .select('*')
    .eq('senha', senhaAtual)
    .single();

  if (erroBusca || !usuarioEncontrado) {
    return res.status(401).json({ erro: 'Senha atual incorreta' });
  }

  const { error } = await supabase
    .from('usuarios')
    .update({ senha: novaSenha })
    .eq('id', usuarioEncontrado.id);

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({ mensagem: 'Senha alterada com sucesso' });
});

// EMPRESA

app.get('/empresa', async (req, res) => {
  const { data, error } = await supabase
    .from('empresa')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !data) {
    return res.json({
      nome: 'Gestão de Danones',
      telefone: '',
      endereco: '',
      instagram: ''
    });
  }

  res.json({
    nome: data.nome || 'Gestão de Danones',
    telefone: data.telefone || '',
    endereco: data.endereco || '',
    instagram: data.instagram || ''
  });
});

app.post('/empresa', async (req, res) => {
  const empresa = {
    id: 1,
    nome: req.body.nome || '',
    telefone: req.body.telefone || '',
    endereco: req.body.endereco || '',
    instagram: req.body.instagram || ''
  };

  const { data, error } = await supabase
    .from('empresa')
    .upsert([empresa])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({
    mensagem: 'Dados da empresa salvos com sucesso',
    empresa: {
      nome: data.nome,
      telefone: data.telefone,
      endereco: data.endereco,
      instagram: data.instagram
    }
  });
});

// PRODUTOS

app.get('/produtos', async (req, res) => {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .order('id', { ascending: false });

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  const produtos = data.map(p => ({
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    custo: Number(p.custo || 0),
    precoVenda: Number(p.preco_venda || 0),
    quantidade: Number(p.quantidade || 0),
    validade: p.validade
  }));

  res.json(produtos);
});

app.post('/produtos', async (req, res) => {
  const novoProduto = {
    id: Date.now(),
    nome: req.body.nome,
    categoria: req.body.categoria || 'Danones',
    custo: Number(req.body.custo || 0),
    preco_venda: Number(req.body.precoVenda || 0),
    quantidade: Number(req.body.quantidade || 0),
    validade: req.body.validade || null,
    ativo: true
  };

  const { data, error } = await supabase
    .from('produtos')
    .insert([novoProduto])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.status(201).json({
    id: data.id,
    nome: data.nome,
    categoria: data.categoria,
    custo: Number(data.custo || 0),
    precoVenda: Number(data.preco_venda || 0),
    quantidade: Number(data.quantidade || 0),
    validade: data.validade
  });
});

app.put('/produtos/:id', async (req, res) => {
  const id = Number(req.params.id);

  const produtoAtualizado = {
    nome: req.body.nome,
    categoria: req.body.categoria || 'Danones',
    custo: Number(req.body.custo || 0),
    preco_venda: Number(req.body.precoVenda || 0),
    quantidade: Number(req.body.quantidade || 0),
    validade: req.body.validade || null
  };

  const { data, error } = await supabase
    .from('produtos')
    .update(produtoAtualizado)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({
    mensagem: 'Produto atualizado com sucesso',
    produto: data
  });
});

app.delete('/produtos/:id', async (req, res) => {
  const id = Number(req.params.id);

  const { error } = await supabase
    .from('produtos')
    .update({ ativo: false })
    .eq('id', id);

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({ mensagem: 'Produto desativado com sucesso' });
});

app.post('/produtos/:id/entrada', async (req, res) => {
  const id = Number(req.params.id);
  const quantidade = Number(req.body.quantidade || 0);

  if (!quantidade || quantidade <= 0) {
    return res.status(400).json({ erro: 'Quantidade inválida' });
  }

  const { data: produto, error: erroBusca } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', id)
    .single();

  if (erroBusca || !produto) {
    return res.status(404).json({ erro: 'Produto não encontrado' });
  }

  const novaQuantidade = Number(produto.quantidade || 0) + quantidade;

  const { data, error } = await supabase
    .from('produtos')
    .update({ quantidade: novaQuantidade })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({
    mensagem: 'Entrada registrada com sucesso',
    produto: data
  });
});

app.post('/produtos/:id/saida', async (req, res) => {
  const id = Number(req.params.id);
  const quantidade = Number(req.body.quantidade || 0);

  if (!quantidade || quantidade <= 0) {
    return res.status(400).json({ erro: 'Quantidade inválida' });
  }

  const { data: produto, error: erroBusca } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', id)
    .single();

  if (erroBusca || !produto) {
    return res.status(404).json({ erro: 'Produto não encontrado' });
  }

  if (Number(produto.quantidade || 0) < quantidade) {
    return res.status(400).json({ erro: 'Estoque insuficiente' });
  }

  const novaQuantidade = Number(produto.quantidade || 0) - quantidade;

  const { data, error } = await supabase
    .from('produtos')
    .update({ quantidade: novaQuantidade })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({
    mensagem: 'Saída registrada com sucesso',
    produto: data
  });
});

app.post('/produtos/:id/perda', async (req, res) => {
  const id = Number(req.params.id);
  const quantidade = Number(req.body.quantidade || 0);
  const motivo = req.body.motivo || 'Perda';
  const observacao = req.body.observacao || '';

  if (!quantidade || quantidade <= 0) {
    return res.status(400).json({ erro: 'Quantidade invalida' });
  }

  const { data: produto, error: erroBusca } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', id)
    .single();

  if (erroBusca || !produto) {
    return res.status(404).json({ erro: 'Produto nao encontrado' });
  }

  if (Number(produto.quantidade || 0) < quantidade) {
    return res.status(400).json({ erro: 'Estoque insuficiente' });
  }

  const novaQuantidade = Number(produto.quantidade || 0) - quantidade;

  const { data, error } = await supabase
    .from('produtos')
    .update({ quantidade: novaQuantidade })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  const valorPerda = Number(produto.custo || 0) * quantidade;

  const { error: erroCaixa } = await supabase
    .from('caixa')
    .insert([{
      id: Date.now() + Math.floor(Math.random() * 1000),
      sync_id: `perda-${Date.now()}-${id}`,
      tipo: 'SAIDA',
      categoria: 'Perda',
      descricao: `Baixa de produto - ${motivo} - ${produto.nome}${observacao ? ' - ' + observacao : ''}`,
      valor: valorPerda,
      data_movimento: new Date().toISOString()
    }]);

  if (erroCaixa) {
    return res.status(500).json({ erro: erroCaixa.message });
  }

  res.json({
    mensagem: 'Baixa registrada com sucesso',
    produto: data,
    perda: {
      produtoId: id,
      produtoNome: produto.nome,
      quantidade,
      motivo,
      observacao,
      valor: valorPerda
    }
  });
});
// CLIENTES

app.get('/clientes/:id/resumo', async (req, res) => {
  const id = Number(req.params.id);

  const { data: cliente, error: erroCliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single();

  if (erroCliente || !cliente) {
    return res.status(404).json({ erro: 'Cliente não encontrado' });
  }

  const { data: vendas, error: erroVendas } = await supabase
    .from('vendas')
    .select('*')
    .eq('cliente_id', id)
    .order('data', { ascending: false });

  if (erroVendas) {
    return res.status(500).json({ erro: erroVendas.message });
  }

  const vendasFormatadas = vendas.map(v => ({
    id: v.id,
    clienteId: v.cliente_id,
    clienteNome: v.cliente_nome,
    produtoId: v.produto_id,
    produtoNome: v.produto_nome,
    quantidade: v.quantidade,
    valorTotal: Number(v.valor_total || 0),
    custoTotal: Number(v.custo_total || 0),
    lucro: Number(v.lucro || 0),
    status: v.status,
    data: v.data,
    dataPagamento: v.data_pagamento,
    dataVencimento: v.data_vencimento,
    valorPago: Number(v.valor_pago || 0),
    saldoRestante: Number(v.saldo_restante || 0)
  }));

  const totalComprado = vendasFormatadas.reduce((soma, venda) => soma + Number(venda.valorTotal || 0), 0);
  const totalPago = vendasFormatadas.reduce((soma, venda) => soma + Number(venda.valorPago || 0), 0);
  const totalAberto = vendasFormatadas.reduce((soma, venda) => soma + Number(venda.saldoRestante || 0), 0);

  res.json({
    cliente: {
      id: cliente.id,
      nome: cliente.nome,
      telefone: cliente.telefone,
      endereco: cliente.endereco,
      observacoes: cliente.observacoes,
      criadoEm: cliente.criado_em
    },
    totalComprado,
    totalPago,
    totalAberto,
    ultimaCompra: vendasFormatadas.length > 0 ? vendasFormatadas[0].data : null,
    vendas: vendasFormatadas
  });
});

app.get('/clientes', async (req, res) => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  const clientes = data.map(c => ({
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    endereco: c.endereco,
    observacoes: c.observacoes,
    criadoEm: c.criado_em
  }));

  res.json(clientes);
});

app.post('/clientes', async (req, res) => {
  const novoCliente = {
    id: Date.now(),
    nome: req.body.nome,
    telefone: req.body.telefone || '',
    endereco: req.body.endereco || '',
    observacoes: req.body.observacoes || '',
    criado_em: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('clientes')
    .insert([novoCliente])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.status(201).json({
    id: data.id,
    nome: data.nome,
    telefone: data.telefone,
    endereco: data.endereco,
    observacoes: data.observacoes,
    criadoEm: data.criado_em
  });
});

app.put('/clientes/:id', async (req, res) => {
  const id = Number(req.params.id);

  const clienteAtualizado = {
    nome: req.body.nome,
    telefone: req.body.telefone || '',
    endereco: req.body.endereco || '',
    observacoes: req.body.observacoes || ''
  };

  const { data, error } = await supabase
    .from('clientes')
    .update(clienteAtualizado)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({
    mensagem: 'Cliente atualizado com sucesso',
    cliente: {
      id: data.id,
      nome: data.nome,
      telefone: data.telefone,
      endereco: data.endereco,
      observacoes: data.observacoes,
      criadoEm: data.criado_em
    }
  });
});

app.delete('/clientes/:id', async (req, res) => {
  const id = Number(req.params.id);

  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({ mensagem: 'Cliente excluído com sucesso' });
});

// VENDAS

app.get('/vendas/:id/pagamentos', async (req, res) => {
  const id = Number(req.params.id);

  const { data, error } = await supabase
    .from('pagamentos')
    .select('*')
    .eq('venda_id', id)
    .order('data_pagamento', { ascending: false });

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json(data.map(p => ({
    id: p.id,
    vendaId: p.venda_id,
    clienteId: p.cliente_id,
    clienteNome: p.cliente_nome,
    valor: Number(p.valor || 0),
    dataPagamento: p.data_pagamento
  })));
});

app.get('/pagamentos-venda/:id', async (req, res) => {
  const id = Number(req.params.id);

  const { data, error } = await supabase
    .from('pagamentos')
    .select('*')
    .eq('venda_id', id)
    .order('data_pagamento', { ascending: false });

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json(data.map(p => ({
    id: p.id,
    vendaId: p.venda_id,
    clienteId: p.cliente_id,
    clienteNome: p.cliente_nome,
    valor: Number(p.valor || 0),
    dataPagamento: p.data_pagamento
  })));
});

app.get('/vendas', async (req, res) => {
  const { data, error } = await supabase
    .from('vendas')
    .select('*')
    .order('data', { ascending: false });

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  const vendas = data.map(v => ({
    id: v.id,
    clienteId: v.cliente_id,
    clienteNome: v.cliente_nome,
    produtoId: v.produto_id,
    produtoNome: v.produto_nome,
    quantidade: v.quantidade,
    valorTotal: Number(v.valor_total || 0),
    custoTotal: Number(v.custo_total || 0),
    lucro: Number(v.lucro || 0),
    status: v.status,
    data: v.data,
    dataPagamento: v.data_pagamento,
    dataVencimento: v.data_vencimento,
    valorPago: Number(v.valor_pago || 0),
    saldoRestante: Number(v.saldo_restante || v.valor_total || 0)
  }));

  res.json(vendas);
});

app.get('/vendas/abertas', async (req, res) => {
  const { data, error } = await supabase
    .from('vendas')
    .select('*')
    .eq('status', 'Em aberto')
    .order('data', { ascending: false });

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  const abertas = data.map(v => ({
    id: v.id,
    clienteId: v.cliente_id,
    clienteNome: v.cliente_nome,
    produtoId: v.produto_id,
    produtoNome: v.produto_nome,
    quantidade: v.quantidade,
    valorTotal: Number(v.valor_total || 0),
    custoTotal: Number(v.custo_total || 0),
    lucro: Number(v.lucro || 0),
    status: v.status,
    data: v.data,
    dataPagamento: v.data_pagamento,
    dataVencimento: v.data_vencimento,
    valorPago: Number(v.valor_pago || 0),
    saldoRestante: Number(v.saldo_restante || v.valor_total || 0)
  }));

  res.json(abertas);
});

app.post('/vendas', async (req, res) => {
  const clienteId = Number(req.body.clienteId);
  const produtoId = Number(req.body.produtoId);
  const quantidade = Number(req.body.quantidade);
  const status = req.body.status || 'Pago';
  const formaPagamento = req.body.formaPagamento || 'Nao informado';
  const clienteAvulso = clienteId === 0;

  if ((!clienteId && !clienteAvulso) || !produtoId || !quantidade || quantidade <= 0) {
    return res.status(400).json({ erro: 'Dados da venda invalidos' });
  }

  if (clienteAvulso && status !== 'Pago') {
    return res.status(400).json({ erro: 'Cliente avulso so pode ser usado em venda paga' });
  }

  if (req.body.syncId) {
    const { data: vendaExistente } = await supabase
      .from('vendas')
      .select('*')
      .eq('sync_id', req.body.syncId)
      .maybeSingle();

    if (vendaExistente) {
      return res.status(200).json({
        id: vendaExistente.id,
        mensagem: 'Venda já sincronizada',
        duplicada: true
      });
    }
  }

  const { data: produto, error: erroProduto } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', produtoId)
    .single();

  if (erroProduto || !produto) {
    return res.status(404).json({ erro: 'Produto não encontrado' });
  }

  const resultadoCliente = await obterClienteParaVenda({
    clienteId,
    clienteNome: req.body.clienteNome,
    clienteAvulso
  });

  if (resultadoCliente.erro) {
    return res.status(clienteAvulso ? 500 : 404).json({ erro: resultadoCliente.erro });
  }

  const cliente = resultadoCliente.cliente;

  if (Number(produto.quantidade || 0) < quantidade) {
    return res.status(400).json({ erro: 'Estoque insuficiente' });
  }

  const valorTotal = Number(produto.preco_venda || 0) * quantidade;
  const custoTotal = Number(produto.custo || 0) * quantidade;
  const lucro = valorTotal - custoTotal;
  const novaQuantidade = Number(produto.quantidade || 0) - quantidade;

  const { error: erroEstoque } = await supabase
    .from('produtos')
    .update({ quantidade: novaQuantidade })
    .eq('id', produtoId);

  if (erroEstoque) {
    return res.status(500).json({ erro: erroEstoque.message });
  }

  const dataVenda = new Date();

  let dataVencimento = null;

  if (status === 'Em aberto') {
    dataVencimento = new Date(dataVenda);
    dataVencimento.setDate(dataVencimento.getDate() + 30);
  }

  const novaVenda = {
    id: Date.now(),
    sync_id: req.body.syncId || null,
    cliente_id: cliente.id,
    cliente_nome: cliente.nome,
    produto_id: produtoId,
    produto_nome: produto.nome,
    quantidade,
    valor_total: valorTotal,
    custo_total: custoTotal,
    lucro,
    status,
    data: dataVenda.toISOString(),
    data_vencimento: dataVencimento ? dataVencimento.toISOString() : null,
    valor_pago: status === 'Pago' ? valorTotal : 0,
    saldo_restante: status === 'Pago' ? 0 : valorTotal
  };

  const { data, error } = await supabase
    .from('vendas')
    .insert([novaVenda])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  if (data.status === 'Pago') {
    await registrarEntradaCaixaAutomatica({
      syncId: data.sync_id ? `caixa-venda-${data.sync_id}` : `caixa-venda-${data.id}`,
      categoria: 'Venda',
      descricao: `Venda paga - ${formaPagamento} - ${data.cliente_nome} - ${data.produto_nome}`,
      valor: data.valor_total,
      dataMovimento: data.data
    });
  }

  res.status(201).json({
    id: data.id,
    clienteId: data.cliente_id,
    clienteNome: data.cliente_nome,
    produtoId: data.produto_id,
    produtoNome: data.produto_nome,
    quantidade: data.quantidade,
    valorTotal: Number(data.valor_total || 0),
    custoTotal: Number(data.custo_total || 0),
    lucro: Number(data.lucro || 0),
    status: data.status,
    data: data.data,
    dataPagamento: data.data_pagamento,
    dataVencimento: data.data_vencimento,
    valorPago: Number(data.valor_pago || 0),
    saldoRestante: Number(data.saldo_restante || 0)
  });
});

app.put('/vendas/:id', async (req, res) => {
  const id = Number(req.params.id);
  const clienteId = Number(req.body.clienteId);
  const status = req.body.status || 'Pago';
  const clienteAvulso = clienteId === 0;

  if ((!clienteId && !clienteAvulso) || !['Pago', 'Em aberto'].includes(status)) {
    return res.status(400).json({ erro: 'Dados da venda invalidos' });
  }

  if (clienteAvulso && status !== 'Pago') {
    return res.status(400).json({ erro: 'Cliente avulso so pode ser usado em venda paga' });
  }

  const { data: vendaAtual, error: erroVenda } = await supabase
    .from('vendas')
    .select('*')
    .eq('id', id)
    .single();

  if (erroVenda || !vendaAtual) {
    return res.status(404).json({ erro: 'Venda nao encontrada' });
  }

  const resultadoCliente = await obterClienteParaVenda({
    clienteId,
    clienteNome: req.body.clienteNome,
    clienteAvulso
  });

  if (resultadoCliente.erro) {
    return res.status(clienteAvulso ? 500 : 404).json({ erro: resultadoCliente.erro });
  }

  const cliente = resultadoCliente.cliente;

  const produtoId = Number(req.body.produtoId || vendaAtual.produto_id);
  const quantidade = Number(req.body.quantidade || vendaAtual.quantidade);

  if (!produtoId || !quantidade || quantidade <= 0) {
    return res.status(400).json({ erro: 'Produto ou quantidade invalidos' });
  }

  const { data: produtoNovo, error: erroProdutoNovo } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', produtoId)
    .single();

  if (erroProdutoNovo || !produtoNovo) {
    return res.status(404).json({ erro: 'Produto nao encontrado' });
  }

  const produtoAntigoId = Number(vendaAtual.produto_id);
  const quantidadeAntiga = Number(vendaAtual.quantidade || 0);
  const mudouProduto = produtoAntigoId !== produtoId;

  if (mudouProduto) {
    const { data: produtoAntigo, error: erroProdutoAntigo } = await supabase
      .from('produtos')
      .select('*')
      .eq('id', produtoAntigoId)
      .single();

    if (erroProdutoAntigo || !produtoAntigo) {
      return res.status(404).json({ erro: 'Produto antigo da venda nao encontrado' });
    }

    if (Number(produtoNovo.quantidade || 0) < quantidade) {
      return res.status(400).json({ erro: 'Estoque insuficiente para o novo produto' });
    }

    const { error: erroRestauraAntigo } = await supabase
      .from('produtos')
      .update({ quantidade: Number(produtoAntigo.quantidade || 0) + quantidadeAntiga })
      .eq('id', produtoAntigoId);

    if (erroRestauraAntigo) {
      return res.status(500).json({ erro: erroRestauraAntigo.message });
    }

    const { error: erroBaixaNovo } = await supabase
      .from('produtos')
      .update({ quantidade: Number(produtoNovo.quantidade || 0) - quantidade })
      .eq('id', produtoId);

    if (erroBaixaNovo) {
      return res.status(500).json({ erro: erroBaixaNovo.message });
    }
  } else {
    const estoqueDisponivel = Number(produtoNovo.quantidade || 0) + quantidadeAntiga;

    if (estoqueDisponivel < quantidade) {
      return res.status(400).json({ erro: 'Estoque insuficiente para alterar a quantidade' });
    }

    const { error: erroAjusteEstoque } = await supabase
      .from('produtos')
      .update({ quantidade: estoqueDisponivel - quantidade })
      .eq('id', produtoId);

    if (erroAjusteEstoque) {
      return res.status(500).json({ erro: erroAjusteEstoque.message });
    }
  }

  const valorTotal = Number(produtoNovo.preco_venda || 0) * quantidade;
  const custoTotal = Number(produtoNovo.custo || 0) * quantidade;
  const lucro = valorTotal - custoTotal;
  let dataVencimento = vendaAtual.data_vencimento;

  if (status === 'Em aberto' && !dataVencimento) {
    const base = vendaAtual.data ? new Date(vendaAtual.data) : new Date();
    base.setDate(base.getDate() + 30);
    dataVencimento = base.toISOString();
  }

  const vendaAtualizada = {
    cliente_id: cliente.id,
    cliente_nome: cliente.nome,
    produto_id: produtoId,
    produto_nome: produtoNovo.nome,
    quantidade,
    valor_total: valorTotal,
    custo_total: custoTotal,
    lucro,
    status,
    data_vencimento: status === 'Em aberto' ? dataVencimento : null,
    valor_pago: status === 'Pago' ? valorTotal : 0,
    saldo_restante: status === 'Pago' ? 0 : valorTotal,
    data_pagamento: status === 'Pago' ? (vendaAtual.data_pagamento || new Date().toISOString()) : null
  };

  const { data, error } = await supabase
    .from('vendas')
    .update(vendaAtualizada)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  const caixaSyncId = vendaAtual.sync_id ? `caixa-venda-${vendaAtual.sync_id}` : `caixa-venda-${vendaAtual.id}`;

  const limparPagamentosDaVenda = async () => {
    const { data: pagamentosVenda } = await supabase
      .from('pagamentos')
      .select('sync_id')
      .eq('venda_id', id);

    if (pagamentosVenda && pagamentosVenda.length > 0) {
      const syncIdsCaixaPagamentos = pagamentosVenda
        .filter(pagamento => pagamento.sync_id)
        .map(pagamento => `caixa-pagamento-${pagamento.sync_id}`);

      if (syncIdsCaixaPagamentos.length > 0) {
        await supabase
          .from('caixa')
          .delete()
          .in('sync_id', syncIdsCaixaPagamentos);
      }

      await supabase
        .from('pagamentos')
        .delete()
        .eq('venda_id', id);
    }
  };

  if (status === 'Pago') {
    await limparPagamentosDaVenda();

    await supabase
      .from('caixa')
      .delete()
      .eq('sync_id', caixaSyncId);

    await registrarEntradaCaixaAutomatica({
      syncId: caixaSyncId,
      categoria: 'Venda',
      descricao: `Venda paga - ${data.cliente_nome} - ${data.produto_nome}`,
      valor: data.valor_total,
      dataMovimento: data.data
    });
  }

  if (status === 'Em aberto') {
    await limparPagamentosDaVenda();

    await supabase
      .from('caixa')
      .delete()
      .eq('sync_id', caixaSyncId);
  }

  res.json({
    mensagem: 'Venda atualizada com sucesso',
    venda: {
      id: data.id,
      clienteId: data.cliente_id,
      clienteNome: data.cliente_nome,
      produtoId: data.produto_id,
      produtoNome: data.produto_nome,
      quantidade: data.quantidade,
      valorTotal: Number(data.valor_total || 0),
      custoTotal: Number(data.custo_total || 0),
      lucro: Number(data.lucro || 0),
      status: data.status,
      data: data.data,
      dataPagamento: data.data_pagamento,
      dataVencimento: data.data_vencimento,
      valorPago: Number(data.valor_pago || 0),
      saldoRestante: Number(data.saldo_restante || 0)
    }
  });
});

app.post('/vendas/:id/receber', async (req, res) => {
  const id = Number(req.params.id);
  const valorRecebido = Number(req.body.valorRecebido || 0);
  const formaPagamento = req.body.formaPagamento || 'Nao informado';

  if (!valorRecebido || valorRecebido <= 0) {
    return res.status(400).json({ erro: 'Valor recebido inválido' });
  }

  const { data: venda, error: erroBusca } = await supabase
    .from('vendas')
    .select('*')
    .eq('id', id)
    .single();

  if (erroBusca || !venda) {
    return res.status(404).json({ erro: 'Venda não encontrada' });
  }

  if (req.body.syncId) {
    const { data: pagamentoExistente } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('sync_id', req.body.syncId)
      .maybeSingle();

    if (pagamentoExistente) {
      return res.status(200).json({
        mensagem: 'Pagamento já sincronizado',
        duplicado: true
      });
    }
  }

  const valorTotal = Number(venda.valor_total || 0);
  const valorPagoAtual = Number(venda.valor_pago || 0);

  const novoValorPago = valorPagoAtual + valorRecebido;
  const valorPagoFinal = Math.min(novoValorPago, valorTotal);
  const novoSaldo = Math.max(valorTotal - valorPagoFinal, 0);
  const novoStatus = novoSaldo === 0 ? 'Pago' : 'Em aberto';

  const { error: erroPagamento } = await supabase
    .from('pagamentos')
    .insert([{
      id: Date.now(),
      sync_id: req.body.syncId || null,
      venda_id: id,
      cliente_id: venda.cliente_id,
      cliente_nome: venda.cliente_nome,
      valor: valorRecebido,
      data_pagamento: new Date().toISOString()
    }]);

  if (erroPagamento) {
    return res.status(500).json({ erro: erroPagamento.message });
  }

  const { data, error } = await supabase
    .from('vendas')
    .update({
      valor_pago: valorPagoFinal,
      saldo_restante: novoSaldo,
      status: novoStatus,
      data_pagamento: novoStatus === 'Pago' ? new Date().toISOString() : null
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  await registrarEntradaCaixaAutomatica({
    syncId: req.body.syncId ? `caixa-pagamento-${req.body.syncId}` : `caixa-pagamento-${id}-${Date.now()}`,
    categoria: 'Recebimento',
    descricao: `Recebimento fiado - ${formaPagamento} - ${venda.cliente_nome}`,
    valor: valorRecebido,
    dataMovimento: new Date().toISOString()
  });

  res.json({
    mensagem: 'Pagamento registrado com sucesso',
    venda: {
      id: data.id,
      valorTotal: Number(data.valor_total || 0),
      valorPago: Number(data.valor_pago || 0),
      saldoRestante: Number(data.saldo_restante || 0),
      status: data.status
    }
  });
});

app.delete('/vendas/:id', async (req, res) => {
  const id = Number(req.params.id);

  const { data: venda, error: erroVenda } = await supabase
    .from('vendas')
    .select('*')
    .eq('id', id)
    .single();

  if (erroVenda || !venda) {
    return res.status(404).json({ erro: 'Venda nao encontrada' });
  }

  const { data: produto, error: erroProduto } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', venda.produto_id)
    .single();

  if (erroProduto || !produto) {
    return res.status(404).json({ erro: 'Produto da venda nao encontrado' });
  }

  const quantidadeRestaurada = Number(venda.quantidade || 0);
  const novaQuantidadeProduto = Number(produto.quantidade || 0) + quantidadeRestaurada;

  const { error: erroEstoque } = await supabase
    .from('produtos')
    .update({
      quantidade: novaQuantidadeProduto
    })
    .eq('id', venda.produto_id);

  if (erroEstoque) {
    return res.status(500).json({ erro: erroEstoque.message });
  }

  const { data: pagamentosVenda } = await supabase
    .from('pagamentos')
    .select('sync_id')
    .eq('venda_id', id);

  const syncIdsCaixa = [];
  const caixaVendaSyncId = venda.sync_id ? `caixa-venda-${venda.sync_id}` : `caixa-venda-${venda.id}`;

  syncIdsCaixa.push(caixaVendaSyncId);

  if (pagamentosVenda && pagamentosVenda.length > 0) {
    pagamentosVenda
      .filter(pagamento => pagamento.sync_id)
      .forEach(pagamento => syncIdsCaixa.push(`caixa-pagamento-${pagamento.sync_id}`));
  }

  const { error: erroCaixa } = await supabase
    .from('caixa')
    .delete()
    .in('sync_id', syncIdsCaixa);

  if (erroCaixa) {
    return res.status(500).json({ erro: erroCaixa.message });
  }

  const { error: erroPagamentos } = await supabase
    .from('pagamentos')
    .delete()
    .eq('venda_id', id);

  if (erroPagamentos) {
    return res.status(500).json({ erro: erroPagamentos.message });
  }

  const { error } = await supabase
    .from('vendas')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({
    mensagem: 'Venda excluida com sucesso',
    estoqueRestaurado: {
      produtoId: venda.produto_id,
      quantidadeRestaurada,
      novaQuantidade: novaQuantidadeProduto
    },
    caixaRemovido: syncIdsCaixa
  });
});

// CAIXA

app.get('/caixa', async (req, res) => {
  const { data, error } = await supabase
    .from('caixa')
    .select('*')
    .order('data_movimento', { ascending: false });

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json(data);
});

app.post('/caixa', async (req, res) => {
  const novaMovimentacao = {
    id: Date.now(),
    sync_id: req.body.syncId || null,
    tipo: req.body.tipo,
    categoria: req.body.categoria,
    descricao: req.body.descricao,
    valor: Number(req.body.valor || 0),
    data_movimento: req.body.dataMovimento || new Date().toISOString()
  };

  if (!novaMovimentacao.tipo || !novaMovimentacao.valor) {
    return res.status(400).json({ erro: 'Dados inválidos' });
  }

  if (req.body.syncId) {
    const { data: existente } = await supabase
      .from('caixa')
      .select('*')
      .eq('sync_id', req.body.syncId)
      .maybeSingle();

    if (existente) {
      return res.status(200).json({
        mensagem: 'Movimentação já sincronizada',
        duplicada: true
      });
    }
  }

  const { data, error } = await supabase
    .from('caixa')
    .insert([novaMovimentacao])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.status(201).json(data);
});

app.delete('/caixa/:id', async (req, res) => {
  const id = Number(req.params.id);

  const { error } = await supabase
    .from('caixa')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({ mensagem: 'Movimentação excluída com sucesso' });
});

// BACKUP

app.get('/backup', async (req, res) => {
  const { data: produtos, error: erroProdutos } = await supabase.from('produtos').select('*');
  const { data: clientes, error: erroClientes } = await supabase.from('clientes').select('*');
  const { data: vendas, error: erroVendas } = await supabase.from('vendas').select('*');
  const { data: pagamentos, error: erroPagamentos } = await supabase.from('pagamentos').select('*');
  const { data: categorias, error: erroCategorias } = await supabase.from('categorias').select('*');
  const { data: empresa, error: erroEmpresa } = await supabase.from('empresa').select('*');
  const { data: caixa, error: erroCaixa } = await supabase.from('caixa').select('*');

  if (erroProdutos || erroClientes || erroVendas || erroPagamentos || erroCategorias || erroEmpresa || erroCaixa) {
    return res.status(500).json({ erro: 'Erro ao gerar backup' });
  }

  res.json({
    produtos,
    clientes,
    vendas,
    pagamentos,
    categorias,
    empresa,
    caixa,
    geradoEm: new Date().toISOString()
  });
});

app.get('/exportar-json/:tabela', async (req, res) => {
  const tabelasPermitidas = ['produtos', 'clientes', 'vendas', 'pagamentos', 'caixa', 'categorias', 'empresa'];
  const tabela = req.params.tabela;

  if (!tabelasPermitidas.includes(tabela)) {
    return res.status(400).json({ erro: 'Tabela invalida para exportacao' });
  }

  const { data, error } = await supabase
    .from(tabela)
    .select('*');

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({
    tabela,
    geradoEm: new Date().toISOString(),
    total: data.length,
    dados: data
  });
});

app.post('/restaurar-backup', async (req, res) => {
  const backup = req.body;

  if (!backup.produtos || !backup.clientes || !backup.vendas) {
    return res.status(400).json({ erro: 'Arquivo de backup inválido' });
  }

  await supabase.from('pagamentos').delete().neq('id', 0);
  await supabase.from('vendas').delete().neq('id', 0);
  await supabase.from('produtos').delete().neq('id', 0);
  await supabase.from('clientes').delete().neq('id', 0);

  if (backup.caixa) await supabase.from('caixa').delete().neq('id', 0);
  if (backup.categorias) await supabase.from('categorias').delete().neq('id', 0);
  if (backup.empresa) await supabase.from('empresa').delete().neq('id', 0);

  if (backup.produtos.length > 0) {
    const { error } = await supabase.from('produtos').insert(backup.produtos);
    if (error) return res.status(500).json({ erro: error.message });
  }

  if (backup.clientes.length > 0) {
    const { error } = await supabase.from('clientes').insert(backup.clientes);
    if (error) return res.status(500).json({ erro: error.message });
  }

  if (backup.vendas.length > 0) {
    const { error } = await supabase.from('vendas').insert(backup.vendas);
    if (error) return res.status(500).json({ erro: error.message });
  }

  if (backup.pagamentos && backup.pagamentos.length > 0) {
    const { error } = await supabase.from('pagamentos').insert(backup.pagamentos);
    if (error) return res.status(500).json({ erro: error.message });
  }

  if (backup.categorias && backup.categorias.length > 0) {
    const { error } = await supabase.from('categorias').insert(backup.categorias);
    if (error) return res.status(500).json({ erro: error.message });
  }

  if (backup.empresa && backup.empresa.length > 0) {
    const { error } = await supabase.from('empresa').insert(backup.empresa);
    if (error) return res.status(500).json({ erro: error.message });
  }

  if (backup.caixa && backup.caixa.length > 0) {
    const { error } = await supabase.from('caixa').insert(backup.caixa);
    if (error) return res.status(500).json({ erro: error.message });
  }

  res.json({ mensagem: 'Backup restaurado com sucesso' });
});

// EXCEL

app.get('/excel/produtos', async (req, res) => {
  const { data: produtos, error } = await supabase
    .from('produtos')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Produtos');

  sheet.columns = [
    { header: 'ID', key: 'id', width: 20 },
    { header: 'Produto', key: 'nome', width: 30 },
    { header: 'Categoria', key: 'categoria', width: 20 },
    { header: 'Custo', key: 'custo', width: 15 },
    { header: 'Preço Venda', key: 'preco_venda', width: 15 },
    { header: 'Quantidade', key: 'quantidade', width: 15 },
    { header: 'Validade', key: 'validade', width: 15 }
  ];

  produtos.forEach(produto => sheet.addRow(produto));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=produtos.xlsx');

  await workbook.xlsx.write(res);
  res.end();
});

app.get('/excel/clientes', async (req, res) => {
  const { data: clientes, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Clientes');

  sheet.columns = [
    { header: 'ID', key: 'id', width: 20 },
    { header: 'Nome', key: 'nome', width: 30 },
    { header: 'Telefone', key: 'telefone', width: 20 },
    { header: 'Endereço', key: 'endereco', width: 35 },
    { header: 'Observações', key: 'observacoes', width: 40 },
    { header: 'Criado em', key: 'criado_em', width: 25 }
  ];

  clientes.forEach(cliente => sheet.addRow(cliente));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=clientes.xlsx');

  await workbook.xlsx.write(res);
  res.end();
});

app.get('/excel/vendas', async (req, res) => {
  const { data: vendas, error } = await supabase
    .from('vendas')
    .select('*')
    .order('data', { ascending: false });

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Vendas');

  sheet.columns = [
    { header: 'ID', key: 'id', width: 20 },
    { header: 'Cliente', key: 'cliente_nome', width: 30 },
    { header: 'Produto', key: 'produto_nome', width: 30 },
    { header: 'Quantidade', key: 'quantidade', width: 15 },
    { header: 'Valor Total', key: 'valor_total', width: 15 },
    { header: 'Custo Total', key: 'custo_total', width: 15 },
    { header: 'Lucro', key: 'lucro', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Data', key: 'data', width: 25 },
    { header: 'Data Pagamento', key: 'data_pagamento', width: 25 }
  ];

  vendas.forEach(venda => sheet.addRow(venda));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=vendas.xlsx');

  await workbook.xlsx.write(res);
  res.end();
});

// CATEGORIAS

app.get('/categorias', async (req, res) => {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json(data.map(c => c.nome));
});

app.post('/categorias', async (req, res) => {
  const nome = req.body.nome;

  if (!nome) {
    return res.status(400).json({ erro: 'Informe o nome da categoria' });
  }

  const { error } = await supabase
    .from('categorias')
    .insert([{ nome }]);

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({ mensagem: 'Categoria criada com sucesso' });
});

app.delete('/categorias/:nome', async (req, res) => {
  const nome = req.params.nome;

  const { error } = await supabase
    .from('categorias')
    .delete()
    .eq('nome', nome);

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({ mensagem: 'Categoria removida' });
});

// TESTE

app.get('/teste-supabase', async (req, res) => {
  const { data, error } = await supabase
    .from('produtos')
    .select('*');

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({
    mensagem: 'Conexão com Supabase funcionando',
    produtos: data
  });
});

// SERVIDOR

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});




