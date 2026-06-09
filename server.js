const express = require('express');
const cors = require('cors');
const fs = require('fs');
const ExcelJS = require('exceljs');
const ARQUIVO_CATEGORIAS = './dados/categorias.json';
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

const ARQUIVO_PRODUTOS = './dados/produtos.json';
const ARQUIVO_CLIENTES = './dados/clientes.json';
const ARQUIVO_VENDAS = './dados/vendas.json';
const ARQUIVO_USUARIOS = './dados/usuarios.json';
const ARQUIVO_EMPRESA = './dados/empresa.json';

function carregarJson(arquivo) {
  try {
    const dados = fs.readFileSync(arquivo, 'utf8');
    return JSON.parse(dados);
  } catch {
    return [];
  }
}

function salvarJson(arquivo, dados) {
  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
}

function carregarProdutos() {
  return carregarJson(ARQUIVO_PRODUTOS);
}

function salvarProdutos(produtos) {
  salvarJson(ARQUIVO_PRODUTOS, produtos);
}

function carregarClientes() {
  return carregarJson(ARQUIVO_CLIENTES);
}

function salvarClientes(clientes) {
  salvarJson(ARQUIVO_CLIENTES, clientes);
}

function carregarVendas() {
  return carregarJson(ARQUIVO_VENDAS);
}

function salvarVendas(vendas) {
  salvarJson(ARQUIVO_VENDAS, vendas);
}

function carregarUsuarios() {
  return carregarJson(ARQUIVO_USUARIOS);
}

function carregarEmpresa() {
  try {
    const dados = fs.readFileSync(ARQUIVO_EMPRESA, 'utf8');
    return JSON.parse(dados);
  } catch {
    return {
      nome: 'Gestão de Danones',
      telefone: '',
      endereco: '',
      instagram: ''
    };
  }
}

function salvarEmpresa(empresa) {
  fs.writeFileSync(ARQUIVO_EMPRESA, JSON.stringify(empresa, null, 2));
}

// LOGIN - SUPABASE

app.post('/login', async (req, res) => {
  const usuario = req.body.usuario;
  const senha = req.body.senha;

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('usuario', usuario)
    .eq('senha', senha)
    .single();

  if (error || !data) {
    return res.status(401).json({
      erro: 'Usuário ou senha incorretos'
    });
  }

  res.json({
    mensagem: 'Login realizado com sucesso',
    usuario: data.usuario
  });
});

app.post('/alterar-senha', async (req, res) => {
  const senhaAtual = req.body.senhaAtual;
  const novaSenha = req.body.novaSenha;

  const { data: usuarioEncontrado, error: erroBusca } = await supabase
    .from('usuarios')
    .select('*')
    .eq('senha', senhaAtual)
    .single();

  if (erroBusca || !usuarioEncontrado) {
    return res.status(401).json({
      erro: 'Senha atual incorreta'
    });
  }

  const { error } = await supabase
    .from('usuarios')
    .update({ senha: novaSenha })
    .eq('id', usuarioEncontrado.id);

  if (error) {
    return res.status(500).json({
      erro: error.message
    });
  }

  res.json({
    mensagem: 'Senha alterada com sucesso'
  });
});

// EMPRESA - SUPABASE

app.get('/empresa', async (req, res) => {
  const { data, error } = await supabase
    .from('empresa')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
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
    return res.status(500).json({
      erro: error.message
    });
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

// PRODUTOS - SUPABASE

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
    custo: Number(p.custo),
    precoVenda: Number(p.preco_venda),
    quantidade: p.quantidade,
    validade: p.validade
  }));

  res.json(produtos);
});

app.post('/produtos', async (req, res) => {
  const novoProduto = {
    id: Date.now(),
    nome: req.body.nome,
    categoria: req.body.categoria || 'Danones',
    custo: Number(req.body.custo),
    preco_venda: Number(req.body.precoVenda),
    quantidade: Number(req.body.quantidade),
    validade: req.body.validade || null
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
    custo: Number(data.custo),
    precoVenda: Number(data.preco_venda),
    quantidade: data.quantidade,
    validade: data.validade
  });
});

app.put('/produtos/:id', async (req, res) => {
  const id = Number(req.params.id);

  const produtoAtualizado = {
    nome: req.body.nome,
    categoria: req.body.categoria || 'Danones',
    custo: Number(req.body.custo),
    preco_venda: Number(req.body.precoVenda),
    quantidade: Number(req.body.quantidade),
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
    return res.status(500).json({
      erro: error.message
    });
  }

  res.json({
    mensagem: 'Produto desativado com sucesso'
  });
});

app.post('/produtos/:id/entrada', async (req, res) => {
  const id = Number(req.params.id);
  const quantidade = Number(req.body.quantidade);

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

  const novaQuantidade = Number(produto.quantidade) + quantidade;

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
  const quantidade = Number(req.body.quantidade);

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

  if (Number(produto.quantidade) < quantidade) {
    return res.status(400).json({ erro: 'Estoque insuficiente' });
  }

  const novaQuantidade = Number(produto.quantidade) - quantidade;

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

// CLIENTES - SUPABASE

app.get('/clientes/:id/resumo', async (req, res) => {
  const id = Number(req.params.id);

  const { data: cliente, error: erroCliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single();

  if (erroCliente || !cliente) {
    return res.status(404).json({
      erro: 'Cliente não encontrado'
    });
  }

  const { data: vendas, error: erroVendas } = await supabase
    .from('vendas')
    .select('*')
    .eq('cliente_id', id)
    .order('data', { ascending: false });

  if (erroVendas) {
    return res.status(500).json({
      erro: erroVendas.message
    });
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

  const totalComprado = vendasFormatadas.reduce(
    (soma, venda) => soma + Number(venda.valorTotal || 0),
    0
  );

  const totalPago = vendasFormatadas.reduce(
    (soma, venda) => soma + Number(venda.valorPago || 0),
    0
  );

  const totalAberto = vendasFormatadas.reduce(
    (soma, venda) => soma + Number(venda.saldoRestante || 0),
    0
  );

  const ultimaCompra =
    vendasFormatadas.length > 0
      ? vendasFormatadas[0].data
      : null;

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
    ultimaCompra,
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

// VENDAS - SUPABASE

app.get('/vendas/:id/pagamentos', async (req, res) => {
  const id = Number(req.params.id);

  const { data, error } = await supabase
    .from('pagamentos')
    .select('*')
    .eq('venda_id', id)
    .order('data_pagamento', { ascending: false });

  if (error) {
    return res.status(500).json({
      erro: error.message
    });
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

  if (!clienteId || !produtoId || !quantidade || quantidade <= 0) {
    return res.status(400).json({
      erro: 'Dados da venda inválidos'
    });
  }

  const { data: produto, error: erroProduto } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', produtoId)
    .single();

  if (erroProduto || !produto) {
    return res.status(404).json({
      erro: 'Produto não encontrado'
    });
  }

  const { data: cliente, error: erroCliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clienteId)
    .single();

  if (erroCliente || !cliente) {
    return res.status(404).json({
      erro: 'Cliente não encontrado'
    });
  }

  if (Number(produto.quantidade) < quantidade) {
    return res.status(400).json({
      erro: 'Estoque insuficiente'
    });
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
    return res.status(500).json({
      erro: erroEstoque.message
    });
  }

  const dataVenda = new Date();

  let dataVencimento = null;

  if (status === 'Em aberto') {
    dataVencimento = new Date(dataVenda);
    dataVencimento.setDate(dataVencimento.getDate() + 30);
  }

  const novaVenda = {
    id: Date.now(),
    cliente_id: clienteId,
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
    return res.status(500).json({
      erro: error.message
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

app.post('/vendas/:id/receber', async (req, res) => {
  const id = Number(req.params.id);
  const valorRecebido = Number(req.body.valorRecebido || 0);

  if (!valorRecebido || valorRecebido <= 0) {
    return res.status(400).json({
      erro: 'Valor recebido inválido'
    });
  }

  const { data: venda, error: erroBusca } = await supabase
    .from('vendas')
    .select('*')
    .eq('id', id)
    .single();

  if (erroBusca || !venda) {
    return res.status(404).json({
      erro: 'Venda não encontrada'
    });
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
      venda_id: id,
      cliente_id: venda.cliente_id,
      cliente_nome: venda.cliente_nome,
      valor: valorRecebido,
      data_pagamento: new Date().toISOString()
    }]);

  if (erroPagamento) {
    return res.status(500).json({
      erro: erroPagamento.message
    });
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
    return res.status(500).json({
      erro: error.message
    });
  }

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

  const { error } = await supabase
    .from('vendas')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({
      erro: error.message
    });
  }

  res.json({
    mensagem: 'Venda excluída com sucesso'
  });
});

// BACKUP - SUPABASE

app.get('/backup', async (req, res) => {
  const { data: produtos, error: erroProdutos } = await supabase
    .from('produtos')
    .select('*');

  const { data: clientes, error: erroClientes } = await supabase
    .from('clientes')
    .select('*');

  const { data: vendas, error: erroVendas } = await supabase
    .from('vendas')
    .select('*');

  const { data: categorias, error: erroCategorias } = await supabase
    .from('categorias')
    .select('*');

  const { data: empresa, error: erroEmpresa } = await supabase
    .from('empresa')
    .select('*');

  if (erroProdutos || erroClientes || erroVendas || erroCategorias || erroEmpresa) {
    return res.status(500).json({
      erro: 'Erro ao gerar backup'
    });
  }

  res.json({
    produtos,
    clientes,
    vendas,
    categorias,
    empresa,
    geradoEm: new Date().toISOString()
  });
});

app.post('/restaurar-backup', async (req, res) => {
  const backup = req.body;

  if (!backup.produtos || !backup.clientes || !backup.vendas) {
    return res.status(400).json({
      erro: 'Arquivo de backup inválido'
    });
  }

  await supabase.from('vendas').delete().neq('id', 0);
  await supabase.from('produtos').delete().neq('id', 0);
  await supabase.from('clientes').delete().neq('id', 0);

  if (backup.categorias) {
    await supabase.from('categorias').delete().neq('id', 0);
  }

  if (backup.empresa) {
    await supabase.from('empresa').delete().neq('id', 0);
  }

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

  if (backup.categorias && backup.categorias.length > 0) {
    const { error } = await supabase.from('categorias').insert(backup.categorias);
    if (error) return res.status(500).json({ erro: error.message });
  }

  if (backup.empresa && backup.empresa.length > 0) {
    const { error } = await supabase.from('empresa').insert(backup.empresa);
    if (error) return res.status(500).json({ erro: error.message });
  }

  res.json({
    mensagem: 'Backup restaurado com sucesso'
  });
});
// EXCEL - SUPABASE

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

  produtos.forEach(produto => {
    sheet.addRow(produto);
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  res.setHeader(
    'Content-Disposition',
    'attachment; filename=produtos.xlsx'
  );

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

  clientes.forEach(cliente => {
    sheet.addRow(cliente);
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  res.setHeader(
    'Content-Disposition',
    'attachment; filename=clientes.xlsx'
  );

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

  vendas.forEach(venda => {
    sheet.addRow(venda);
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  res.setHeader(
    'Content-Disposition',
    'attachment; filename=vendas.xlsx'
  );

  await workbook.xlsx.write(res);
  res.end();
});
// SERVIDOR

// CATEGORIAS - SUPABASE

app.get('/categorias', async (req, res) => {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    return res.status(500).json({
      erro: error.message
    });
  }

  const categorias = data.map(c => c.nome);

  res.json(categorias);
});

app.post('/categorias', async (req, res) => {
  const nome = req.body.nome;

  if (!nome) {
    return res.status(400).json({
      erro: 'Informe o nome da categoria'
    });
  }

  const { error } = await supabase
    .from('categorias')
    .insert([{ nome }]);

  if (error) {
    return res.status(500).json({
      erro: error.message
    });
  }

  res.json({
    mensagem: 'Categoria criada com sucesso'
  });
});

app.delete('/categorias/:nome', async (req, res) => {
  const nome = req.params.nome;

  const { error } = await supabase
    .from('categorias')
    .delete()
    .eq('nome', nome);

  if (error) {
    return res.status(500).json({
      erro: error.message
    });
  }

  res.json({
    mensagem: 'Categoria removida'
  });
});

app.get('/teste-supabase', async (req, res) => {
  const { data, error } = await supabase
    .from('produtos')
    .select('*');

  if (error) {
    return res.status(500).json({
      erro: error.message
    });
  }

  res.json({
    mensagem: 'Conexão com Supabase funcionando',
    produtos: data
  });
});

app.get('/pagamentos-venda/:id', async (req, res) => {
  const id = Number(req.params.id);

  const { data, error } = await supabase
    .from('pagamentos')
    .select('*')
    .eq('venda_id', id)
    .order('data_pagamento', { ascending: false });

  if (error) {
    return res.status(500).json({
      erro: error.message
    });
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

app.listen(3001, () => {
  console.log('Servidor rodando na porta 3001');
});